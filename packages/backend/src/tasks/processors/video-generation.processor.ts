import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import type { VideoOptions, TaskError, TaskProgress, TaskResult } from '@aigc/shared-types';
import { VolcanoClientProvider, type VolcanoVideoTask } from '../../ai/providers/volcano-client.provider';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Video } from '../../modules/generation/entities/video.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';
import { Material } from '../../modules/materials/entities/material.entity';
import { TasksGateway } from '../../websocket/tasks.gateway';
import { QUEUES } from '../queues';

interface VideoGenerationJob {
  taskId: string;
  scriptId: string;
  options?: VideoOptions;
}

interface PollingOptions {
  maxAttempts: number;
  intervalMs: number;
}

interface VideoSegmentPlan {
  index: number;
  scenes: Scene[];
  duration: number;
}

type ContinuitySource = 'generated_first_frame' | 'product_image' | 'previous_last_frame' | 'text_only';
type ProgressPhase =
  | 'queued'
  | 'prepare'
  | 'build_segments'
  | 'submit_segment'
  | 'generate_segment'
  | 'retry_segment'
  | 'persist_result'
  | 'done'
  | 'failed';
type SegmentResult = NonNullable<TaskResult['segments']>[number];

const MIN_PROVIDER_DURATION = 4;
const MAX_PROVIDER_DURATION = 12;
const PREPARE_PROGRESS = 3;
const SEGMENT_PROGRESS_START = 8;
const SEGMENT_PROGRESS_END = 100;
const DEFAULT_POLLING: PollingOptions = {
  maxAttempts: 180,
  intervalMs: 5000,
};

@Processor(QUEUES.VIDEO_GENERATION)
export class VideoGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoGenerationProcessor.name);
  private polling = DEFAULT_POLLING;

  constructor(
    @InjectRepository(GenerationTask) private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Video) private readonly videosRepository: Repository<Video>,
    @InjectRepository(Material) private readonly materialsRepository: Repository<Material>,
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly tasksGateway: TasksGateway,
    private readonly configService: ConfigService,
  ) {
    super();
    this.polling = this.getPollingOptions();
  }

  configurePollingForTest(options: PollingOptions) {
    this.polling = options;
  }

  async process(job: Job<VideoGenerationJob>): Promise<Record<string, unknown>> {
    const { taskId, scriptId, options } = job.data;
    this.logger.log(`Starting video generation for task=${taskId}, script=${scriptId}`);

    try {
      const task = await this.findTask(taskId);
      task.status = 'processing';
      task.error = null;
      await this.tasksRepository.save(task);

      const startedAt = Date.now();
      await this.updateProgress(job, {
        phase: 'prepare',
        percentage: PREPARE_PROGRESS,
        message: '正在读取剧本和分镜...',
        elapsedSeconds: this.elapsedSeconds(startedAt),
      });
      const script = await this.findScript(scriptId);

      await this.updateProgress(job, {
        phase: 'build_segments',
        percentage: SEGMENT_PROGRESS_START,
        message: '正在构建分镜视频任务...',
        elapsedSeconds: this.elapsedSeconds(startedAt),
      });
      const segments = this.buildSegments(script);
      const segmentResults: SegmentResult[] = this.getReusableSegments(task.result?.segments, segments.length);
      const continuityWarnings: string[] = [];
      const productImageUrls = await this.collectProductImageUrls(script);

      for (const segment of segments) {
        const reusable = segmentResults[segment.index];
        if (reusable?.status === 'succeeded' && reusable.video_url) {
          continue;
        }

        const frameInput = await this.prepareSegmentFirstFrame(
          script,
          segment,
          productImageUrls,
          continuityWarnings,
          options?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
        );

        const submittedSegment = this.makeSegmentPlaceholder(
          segment,
          options,
          frameInput.inputFrameUrl,
          frameInput.continuitySource,
          'submitted',
        );
        segmentResults[segment.index] = submittedSegment;
        await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
        await this.updateSegmentProgress(job, segment, segments.length, 0, 'submit_segment', startedAt);

        try {
          const createdTask = await this.createVideoTaskForSegment(script, segment, {
            ratio: options?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
            resolution: this.toProviderResolution(options?.resolution),
            duration: segment.duration,
            firstFrameUrl: frameInput.firstFrameUrl,
            inputFrameUrl: frameInput.inputFrameUrl,
            continuitySource: frameInput.continuitySource,
          });

          segmentResults[segment.index] = {
            ...submittedSegment,
            status: 'running',
            provider_task_id: createdTask.id,
            input_frame_url: createdTask.inputFrameUrl,
            continuity_source: createdTask.continuitySource,
          };
          await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
          await this.updateSegmentProgress(job, segment, segments.length, 0.1, 'generate_segment', startedAt);

          const providerTask = await this.waitForProviderTask(createdTask.id, async (attempt) => {
            const ratio = Math.min(0.1 + (attempt / Math.max(this.polling.maxAttempts, 1)) * 0.85, 0.95);
            await this.updateSegmentProgress(job, segment, segments.length, ratio, 'generate_segment', startedAt);
          });
          const segmentStartedAt = segmentResults[segment.index]?.started_at;
          const segmentResult = this.toSegmentResult(
            providerTask,
            options,
            segment,
            createdTask.inputFrameUrl,
            createdTask.continuitySource,
            createdTask.id,
            segmentStartedAt,
          );
          segmentResults[segment.index] = segmentResult;
          await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
          await this.updateSegmentProgress(job, segment, segments.length, 1, 'generate_segment', startedAt);
        } catch (error) {
          const taskError = this.toTaskError(error, segment.index);
          segmentResults[segment.index] = {
            ...segmentResults[segment.index],
            status: 'failed',
            error: taskError,
            completed_at: new Date().toISOString(),
          };
          await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
          throw error;
        }
      }

      const completedSegments = segmentResults.filter((segment) => segment?.status === 'succeeded');
      const result = this.toTaskResult(completedSegments, options, continuityWarnings);

      await this.updateProgress(job, {
        phase: 'persist_result',
        percentage: 100,
        message: '正在保存分镜视频结果...',
        segmentIndex: segments.length,
        segmentTotal: segments.length,
        elapsedSeconds: this.elapsedSeconds(startedAt),
      });
      task.status = 'done';
      task.progress = this.makeProgress({
        phase: 'done',
        percentage: 100,
        message: '分镜视频已生成',
        segmentIndex: segments.length,
        segmentTotal: segments.length,
        elapsedSeconds: this.elapsedSeconds(startedAt),
      });
      task.result = result;
      task.error = null;
      task.completedAt = new Date();
      await this.tasksRepository.save(task);
      await this.videosRepository.save(
        this.videosRepository.create({
          taskId: task.id,
          merchantId: script.merchantId,
          scriptId: script.id,
          url: result.video_url,
          thumbnailUrl: result.thumbnail_url,
          duration: result.duration,
          resolution: result.resolution,
          aspectRatio: result.aspect_ratio,
          fileSize: result.file_size,
          exportFormats: [{ format: 'mp4', resolution: result.resolution, quality: 'high' }],
        }),
      );
      this.tasksGateway.emitTaskCompleted(task.id, result);
      return { status: 'done', taskId: task.id, result };
    } catch (error) {
      await this.markFailed(taskId, error);
      throw error;
    }
  }

  private getPollingOptions(): PollingOptions {
    return {
      maxAttempts: this.readPositiveInt('VOLCANO_VIDEO_POLL_ATTEMPTS', DEFAULT_POLLING.maxAttempts),
      intervalMs: this.readPositiveInt('VOLCANO_VIDEO_POLL_INTERVAL_MS', DEFAULT_POLLING.intervalMs),
    };
  }

  private readPositiveInt(key: string, fallback: number) {
    const raw = this.configService.get<string>(key) ?? process.env[key];
    const value = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private async findTask(taskId: string) {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new Error(`Generation task ${taskId} not found`);
    return task;
  }

  private async findScript(scriptId: string) {
    const script = await this.scriptsRepository.findOne({
      where: { id: scriptId },
      relations: { scenes: true },
      order: { scenes: { order: 'ASC' } },
    });
    if (!script) throw new Error(`Script ${scriptId} not found`);
    return script;
  }

  private buildSegments(script: Script): VideoSegmentPlan[] {
    const scenes = [...(script.scenes ?? [])].sort((a, b) => a.order - b.order);
    if (scenes.length === 0) {
      return [{ index: 0, scenes: [], duration: this.toProviderDuration(script.totalDuration) }];
    }

    return scenes.map((scene, index) => ({
      index,
      scenes: [scene],
      duration: this.toProviderDuration(scene.duration),
    }));
  }

  private buildPrompt(script: Script, segment: VideoSegmentPlan, continuitySource: ContinuitySource) {
    const sortedScenes = [...segment.scenes].sort((a, b) => a.order - b.order);
    const scene = sortedScenes[0];
    const visualAction = scene?.visualPrompt || scene?.description || 'Show the product clearly.';
    const continuityInstruction = this.getContinuityInstruction(continuitySource);

    return [
      'Create one TikTok Shop video segment.',
      '',
      'Task:',
      'Generate only the current scene. Do not add extra story beats.',
      '',
      'Visual action:',
      visualAction,
      '',
      'Product identity:',
      `Product: ${script.productInfo.name || 'the product'}`,
      `Category: ${script.productInfo.category || 'e-commerce product'}`,
      `Selling points: ${(script.productInfo.selling_points ?? []).join(', ') || 'core product benefits'}`,
      script.productInfo.description ? `Description: ${script.productInfo.description}` : '',
      '',
      'Continuity:',
      continuityInstruction,
      'Preserve product identity, color, shape, material, lighting, and commercial style.',
      '',
      'Scene details:',
      `Camera: ${scene?.cameraMotion || 'fixed'}`,
      `Output duration: ${segment.duration} seconds.`,
      `Voiceover: ${scene?.dialogue || ''}`,
      `Subtitle: ${scene?.subtitle || ''}`,
      '',
      'Constraints:',
      (scene?.constraints ?? []).join(', ') || 'Keep the product visible and recognizable.',
      'Keep the product visible, commercially safe, and suitable for e-commerce conversion.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private getContinuityInstruction(continuitySource: ContinuitySource) {
    if (continuitySource === 'generated_first_frame') {
      return 'Use the provided Seedream-generated first frame as the exact visual starting point for this scene.';
    }
    if (continuitySource === 'previous_last_frame') {
      return 'Use the provided first frame from the previous segment. Continue from it and only perform the current scene action.';
    }
    if (continuitySource === 'product_image') {
      return 'Use the provided product image as the first-frame visual anchor.';
    }
    return 'No image input is available. Generate from the current scene prompt and product identity.';
  }

  private async collectProductImageUrls(script: Script) {
    const urls = new Set<string>();
    const materialIds = script.sourceMaterialIds ?? [];
    if (materialIds.length > 0) {
      const materials = await this.materialsRepository.findBy({
        id: In(materialIds),
        merchantId: script.merchantId,
        type: 'image',
      });
      const sorted = [...materials].sort((a, b) => {
        const aProduct = a.category === 'product' ? 0 : 1;
        const bProduct = b.category === 'product' ? 0 : 1;
        return aProduct - bProduct;
      });
      for (const material of sorted) {
        const url = await this.toMaterialImageInput(material);
        if (url) urls.add(url);
      }
    }

    for (const url of script.productInfo.images ?? []) {
      const normalized = await this.toProductImageInput(url);
      if (normalized) urls.add(normalized);
    }

    return [...urls];
  }

  private async toMaterialImageInput(material: Material) {
    if (/^https?:\/\//i.test(material.url) || material.url.startsWith('data:')) return material.url;
    return this.toLocalUploadDataUrl(material.url, material.mimeType || 'image/jpeg');
  }

  private async toProductImageInput(url: string) {
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
      return this.toLocalUploadDataUrl(url, this.inferImageMimeType(url));
    }
    return undefined;
  }

  private async toLocalUploadDataUrl(url: string, mimeType: string) {
    try {
      const storage = this.configService.get<{ localPath: string }>('storage');
      const localPath = storage?.localPath ?? join(process.cwd(), 'uploads');
      const relative = url.replace(/^\/?uploads\/?/, '');
      const filePath = join(localPath, relative || basename(url));
      const bytes = await fs.readFile(filePath);
      return `data:${mimeType};base64,${bytes.toString('base64')}`;
    } catch {
      return undefined;
    }
  }

  private inferImageMimeType(url: string) {
    const clean = url.split('?')[0].toLowerCase();
    if (clean.endsWith('.png')) return 'image/png';
    if (clean.endsWith('.webp')) return 'image/webp';
    if (clean.endsWith('.gif')) return 'image/gif';
    if (clean.endsWith('.avif')) return 'image/avif';
    return 'image/jpeg';
  }

  private async prepareSegmentFirstFrame(
    script: Script,
    segment: VideoSegmentPlan,
    productImageUrls: string[],
    continuityWarnings: string[],
    aspectRatio: string,
  ) {
    if (productImageUrls.length === 0) {
      throw this.makeProductImageRequiredError(segment.index);
    }

    try {
      const generated = await this.volcanoClient.generateFirstFrame({
        prompt: this.buildFirstFramePrompt(script, segment),
        referenceImages: productImageUrls,
        size: this.toFirstFrameSize(aspectRatio),
      });
      return {
        firstFrameUrl: generated.url,
        inputFrameUrl: generated.url,
        continuitySource: 'generated_first_frame' as const,
      };
    } catch (error) {
      continuityWarnings.push(
        `Segment ${segment.index + 1} Seedream first-frame generation failed; retrying Seedream with a simplified product-first prompt: ${this.toErrorMessage(error)}`,
      );
    }

    try {
      const generated = await this.volcanoClient.generateFirstFrame({
        prompt: this.buildFirstFrameRetryPrompt(script, segment),
        referenceImages: productImageUrls,
        size: this.toFirstFrameSize(aspectRatio),
      });
      return {
        firstFrameUrl: generated.url,
        inputFrameUrl: generated.url,
        continuitySource: 'generated_first_frame' as const,
      };
    } catch (error) {
      throw this.makeFirstFrameGenerationError(segment.index, error);
    }
  }

  private buildFirstFramePrompt(script: Script, segment: VideoSegmentPlan) {
    const scene = [...segment.scenes].sort((a, b) => a.order - b.order)[0];
    const action = scene?.visualPrompt || scene?.description || 'Product hero shot';
    return [
      'Create a single ecommerce video first frame for TikTok Shop.',
      `Product: ${script.productInfo.name || 'the product'}.`,
      `Category: ${script.productInfo.category || 'ecommerce product'}.`,
      `Selling points: ${(script.productInfo.selling_points ?? []).join(', ') || 'core product benefits'}.`,
      script.productInfo.description ? `Description: ${script.productInfo.description}.` : '',
      `Scene visual action: ${action}.`,
      `Camera direction: ${scene?.cameraMotion || 'fixed product shot'}.`,
      `Commercial style: ${script.visualStyle || 'clean, conversion-focused product demo'}.`,
      'The product from the reference image must be clearly visible, recognizable, and faithful in shape, color, material, and packaging.',
      'Do not replace the product with a different item. Do not create abstract or unrelated lifestyle imagery.',
      (scene?.constraints ?? []).join(', '),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildFirstFrameRetryPrompt(script: Script, segment: VideoSegmentPlan) {
    const scene = [...segment.scenes].sort((a, b) => a.order - b.order)[0];
    const action = scene?.visualPrompt || scene?.description || 'clean product first frame';
    return [
      'Create one clean ecommerce video first frame from the reference product image.',
      `Product: ${script.productInfo.name || 'the product'}.`,
      `Scene: ${action}.`,
      'Keep the reference product clearly visible and faithful to its real shape, color, material, logo, and packaging.',
      'Use a simple commercial product-demo composition with no extra objects that could change the product identity.',
    ].join('\n');
  }

  private async createVideoTaskForSegment(
    script: Script,
    segment: VideoSegmentPlan,
    input: {
      ratio: string;
      resolution: string;
      duration: number;
      firstFrameUrl?: string;
      inputFrameUrl: string;
      continuitySource: ContinuitySource;
    },
  ) {
    const created = await this.volcanoClient.createVideoTask({
      prompt: this.buildPrompt(script, segment, input.continuitySource),
      ratio: input.ratio,
      resolution: input.resolution,
      duration: input.duration,
      imageUrls: [],
      firstFrameUrl: input.firstFrameUrl,
    });
    return { ...created, inputFrameUrl: input.inputFrameUrl, continuitySource: input.continuitySource };
  }

  private makeProductImageRequiredError(segmentIndex: number) {
    const error = new Error('PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME: 请先上传或填写商品图后再生成视频。');
    Object.assign(error, {
      code: 'PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME',
      retryable: true,
      segmentIndex,
    });
    return error;
  }

  private makeFirstFrameGenerationError(segmentIndex: number, cause: unknown) {
    const error = new Error(
      `SEEDREAM_FIRST_FRAME_GENERATION_FAILED: Seedream 首帧生成失败，请检查商品图或简化分镜提示词后重试。${this.toErrorMessage(cause) ? ` 原因：${this.toErrorMessage(cause)}` : ''}`,
    );
    Object.assign(error, {
      code: 'SEEDREAM_FIRST_FRAME_GENERATION_FAILED',
      retryable: true,
      segmentIndex,
    });
    return error;
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private toFirstFrameSize(aspectRatio: string) {
    if (aspectRatio === '16:9') return '2848x1600';
    if (aspectRatio === '1:1') return '1920x1920';
    return '1600x2848';
  }

  private async waitForProviderTask(providerTaskId: string, onAttempt?: (attempt: number) => Promise<void>) {
    for (let attempt = 0; attempt < this.polling.maxAttempts; attempt += 1) {
      if (onAttempt) await onAttempt(attempt);
      let result: VolcanoVideoTask;
      try {
        result = await this.volcanoClient.getVideoTask(providerTaskId);
      } catch (error) {
        const maybe = error as { retryable?: boolean };
        if (maybe.retryable !== false && attempt < this.polling.maxAttempts - 1) {
          await this.sleep(this.polling.intervalMs);
          continue;
        }
        throw error;
      }
      if (result.status === 'succeeded') return result;
      if (result.status === 'failed' || result.status === 'expired' || result.status === 'cancelled') {
        const error = new Error(result.error?.message || `Video generation ${result.status}`);
        Object.assign(error, {
          code: result.error?.code || `VIDEO_GENERATION_${result.status.toUpperCase()}`,
          retryable: result.status !== 'cancelled',
        });
        throw error;
      }
      if (attempt < this.polling.maxAttempts - 1) await this.sleep(this.polling.intervalMs);
    }

    const timeout = new Error('Video generation timed out');
    Object.assign(timeout, { code: 'VIDEO_GENERATION_TIMEOUT' });
    throw timeout;
  }

  private toSegmentResult(
    providerTask: VolcanoVideoTask,
    options: VideoOptions | undefined,
    segment: VideoSegmentPlan,
    inputFrameUrl: string,
    continuitySource: ContinuitySource,
    providerTaskId: string,
    startedAt?: string,
  ) {
    const videoUrl = providerTask.content?.video_url || providerTask.content?.file_url || '';
    if (!videoUrl) throw new Error('Video generation succeeded without video_url');

    return {
      index: segment.index,
      video_url: videoUrl,
      thumbnail_url: providerTask.content?.last_frame_url || '',
      duration: providerTask.duration ?? segment.duration,
      resolution: options?.resolution ?? this.fromProviderResolution(providerTask.resolution),
      aspect_ratio: options?.aspect_ratio ?? providerTask.ratio ?? this.inferAspectRatio(options?.resolution),
      scene_orders: segment.scenes.map((scene) => scene.order),
      input_frame_url: inputFrameUrl,
      continuity_source: continuitySource,
      status: 'succeeded' as const,
      provider_task_id: providerTaskId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  }

  private toTaskResult(
    segments: NonNullable<TaskResult['segments']>,
    options: VideoOptions | undefined,
    continuityWarnings: string[] = [],
  ): TaskResult {
    const first = segments[0];
    if (!first) throw new Error('Video generation completed without segments');
    const result: TaskResult = {
      video_url: first.video_url,
      thumbnail_url: first.thumbnail_url,
      duration: segments.reduce((sum, segment) => sum + segment.duration, 0),
      resolution: options?.resolution ?? first.resolution,
      aspect_ratio: options?.aspect_ratio ?? first.aspect_ratio,
      file_size: 0,
      segments,
    };
    if (continuityWarnings.length > 0) {
      result.continuity_warning = continuityWarnings.join('; ');
    }

    return result;
  }

  private getReusableSegments(segments: TaskResult['segments'] | undefined, expectedCount: number): SegmentResult[] {
    const reusable: SegmentResult[] = [];
    for (let index = 0; index < expectedCount; index += 1) {
      const segment = segments?.find((item) => item.index === index);
      if (!segment || segment.status !== 'succeeded' || !segment.video_url) break;
      reusable[index] = segment;
    }
    return reusable;
  }

  private makeSegmentPlaceholder(
    segment: VideoSegmentPlan,
    options: VideoOptions | undefined,
    inputFrameUrl: string,
    continuitySource: ContinuitySource,
    status: 'submitted' | 'running',
  ): SegmentResult {
    return {
      index: segment.index,
      video_url: '',
      thumbnail_url: '',
      duration: segment.duration,
      resolution: options?.resolution ?? this.fromProviderResolution(),
      aspect_ratio: options?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
      scene_orders: segment.scenes.map((scene) => scene.order),
      input_frame_url: inputFrameUrl,
      continuity_source: continuitySource,
      status,
      started_at: new Date().toISOString(),
    };
  }

  private async persistSegmentState(
    task: GenerationTask,
    segments: SegmentResult[],
    options: VideoOptions | undefined,
    continuityWarnings: string[],
  ) {
    task.result = this.toPartialTaskResult(segments.filter(Boolean), options, continuityWarnings);
    await this.tasksRepository.save(task);
  }

  private toPartialTaskResult(
    segments: SegmentResult[],
    options: VideoOptions | undefined,
    continuityWarnings: string[] = [],
  ): TaskResult {
    const firstSucceeded = segments.find((segment) => segment.status === 'succeeded' && segment.video_url);
    const first = firstSucceeded ?? segments[0];
    const result: TaskResult = {
      video_url: first?.video_url ?? '',
      thumbnail_url: first?.thumbnail_url ?? '',
      duration: segments.reduce((sum, segment) => sum + (segment.duration || 0), 0),
      resolution: options?.resolution ?? first?.resolution ?? '1080x1920',
      aspect_ratio: options?.aspect_ratio ?? first?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
      file_size: 0,
      segments,
    };
    if (continuityWarnings.length > 0) {
      result.continuity_warning = continuityWarnings.join('; ');
    }
    return result;
  }

  private async markFailed(taskId: string, error: unknown) {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) return;

    const taskError = this.toTaskError(error);
    task.status = 'failed';
    task.error = taskError;
    task.completedAt = new Date();
    task.progress = this.makeProgress({
      phase: 'failed',
      percentage: task.progress?.percentage ?? 0,
      message: taskError.message,
      segmentIndex: taskError.segment_index,
      segmentTotal: task.progress?.segment_total,
      elapsedSeconds: task.progress?.elapsed_seconds,
    });
    await this.tasksRepository.save(task);
    this.tasksGateway.emitTaskFailed(task.id, taskError);
  }

  private toTaskError(error: unknown, segmentIndex?: number): TaskError {
    const maybe = error as { code?: string; message?: string; status?: number; retryable?: boolean; segmentIndex?: number };
    const code = maybe.code || 'VIDEO_GENERATION_FAILED';
    const message = maybe.message || 'Video generation failed';
    const category = this.classifyError(code, message, maybe.status);
    return {
      code,
      message,
      retryable: maybe.retryable ?? category !== 'moderation',
      category,
      segment_index:
        segmentIndex === undefined
          ? maybe.segmentIndex === undefined
            ? undefined
            : maybe.segmentIndex + 1
          : segmentIndex + 1,
      user_action:
        category === 'moderation'
          ? '请修改失败分镜的提示词，移除可能触发审核的内容后重试。'
          : '可以从失败镜头继续重试。',
    };
  }

  private classifyError(code: string, message: string, status?: number): NonNullable<TaskError['category']> {
    const text = `${code} ${message}`.toLowerCase();
    if (status === 429 || text.includes('rate')) return 'rate_limit';
    if (text.includes('timeout') || text.includes('timed out')) return 'timeout';
    if (text.includes('network') || text.includes('econn') || text.includes('fetch')) return 'network';
    if (
      text.includes('moderation') ||
      text.includes('审核') ||
      text.includes('安全') ||
      text.includes('sensitive') ||
      text.includes('policy')
    ) {
      return 'moderation';
    }
    if (code || message) return 'provider';
    return 'unknown';
  }

  private async updateSegmentProgress(
    job: Job<VideoGenerationJob>,
    segment: VideoSegmentPlan,
    segmentTotal: number,
    segmentRatio: number,
    phase: ProgressPhase,
    startedAt: number,
  ) {
    const segmentSpan = (SEGMENT_PROGRESS_END - SEGMENT_PROGRESS_START) / Math.max(segmentTotal, 1);
    const percentage = Math.round(
      SEGMENT_PROGRESS_START + segmentSpan * segment.index + segmentSpan * Math.min(Math.max(segmentRatio, 0), 1),
    );
    const segmentIndex = segment.index + 1;
    const verb = phase === 'submit_segment' ? '正在提交' : '正在生成';
    await this.updateProgress(job, {
      phase,
      percentage,
      message: `${verb}第 ${segmentIndex}/${segmentTotal} 个镜头...`,
      segmentIndex,
      segmentTotal,
      elapsedSeconds: this.elapsedSeconds(startedAt),
    });
  }

  private async updateProgress(
    job: Job<VideoGenerationJob>,
    input: {
      phase: ProgressPhase;
      percentage: number;
      message: string;
      segmentIndex?: number;
      segmentTotal?: number;
      elapsedSeconds?: number;
      detail?: string;
    },
  ) {
    const progress = this.makeProgress(input);
    await job.updateProgress(progress);
    const task = await this.tasksRepository.findOne({ where: { id: job.data.taskId } });
    if (task) {
      task.progress = progress;
      await this.tasksRepository.save(task);
    }
    this.tasksGateway.emitTaskProgress(job.data.taskId, progress);
    this.logger.log(`[${progress.percentage}%] ${input.message}`);
  }

  private makeProgress(input: {
    phase: ProgressPhase;
    percentage: number;
    message: string;
    segmentIndex?: number;
    segmentTotal?: number;
    elapsedSeconds?: number;
    detail?: string;
  }): TaskProgress {
    const totalSteps = Math.max((input.segmentTotal ?? 0) + 2, 3);
    const currentStep =
      input.phase === 'done'
        ? totalSteps
        : input.segmentIndex
          ? Math.min(input.segmentIndex + 1, totalSteps - 1)
          : input.phase === 'build_segments'
            ? 2
            : 1;
    const percentage = Math.min(Math.max(Math.round(input.percentage), 0), 100);
    return {
      current_step: currentStep,
      total_steps: totalSteps,
      step_name: input.phase,
      percentage,
      message: input.message,
      estimated_remaining: this.estimateRemainingSeconds(input.segmentIndex, input.segmentTotal, input.elapsedSeconds),
      phase: input.phase,
      phase_label: this.phaseLabel(input.phase),
      segment_index: input.segmentIndex,
      segment_total: input.segmentTotal,
      elapsed_seconds: input.elapsedSeconds,
      detail: input.detail,
    };
  }

  private estimateRemainingSeconds(segmentIndex?: number, segmentTotal?: number, elapsedSeconds = 0) {
    if (!segmentTotal) return 90;
    if (!segmentIndex || segmentIndex <= 0) return segmentTotal * 90;
    const averagePerSegment = Math.max(elapsedSeconds / segmentIndex, 60);
    return Math.max(Math.round((segmentTotal - segmentIndex) * averagePerSegment), 0);
  }

  private phaseLabel(phase: ProgressPhase) {
    const labels: Record<ProgressPhase, string> = {
      queued: '排队中',
      prepare: '准备任务',
      build_segments: '构建分镜',
      submit_segment: '提交镜头',
      generate_segment: '生成镜头',
      retry_segment: '重试镜头',
      persist_result: '保存结果',
      done: '分镜完成',
      failed: '生成失败',
    };
    return labels[phase];
  }

  private elapsedSeconds(startedAt: number) {
    return Math.max(Math.round((Date.now() - startedAt) / 1000), 0);
  }

  private inferAspectRatio(resolution?: string) {
    if (resolution === '1920x1080') return '16:9';
    if (resolution === '1080x1080') return '1:1';
    return '9:16';
  }

  private toProviderDuration(duration?: number) {
    const requested = Math.round(Number(duration) || MIN_PROVIDER_DURATION);
    return Math.min(Math.max(requested, MIN_PROVIDER_DURATION), MAX_PROVIDER_DURATION);
  }

  private toProviderResolution(resolution?: string) {
    if (!resolution) return '1080p';
    return resolution.includes('1920') || resolution.includes('1080') ? '1080p' : resolution;
  }

  private fromProviderResolution(resolution?: string) {
    if (resolution === '1080p') return '1080x1920';
    return resolution || '1080x1920';
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
