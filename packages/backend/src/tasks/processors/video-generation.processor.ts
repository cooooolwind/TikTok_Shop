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
import {
  buildFirstFramePrompt,
  buildFirstFrameRetryPrompt,
  buildSegmentVideoPrompt,
} from '../../ai/prompts';
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
      const segmentProgress = segments.map((segment) =>
        segmentResults[segment.index]?.status === 'succeeded' ? 1 : 0,
      );

      const generationResults = await Promise.allSettled(
        segments.map((segment) => {
          const reusable = segmentResults[segment.index];
          if (reusable?.status === 'succeeded' && reusable.video_url) {
            return Promise.resolve();
          }

          return this.runIndependentSegmentPipeline({
            job,
            task,
            script,
            segment,
            segments,
            segmentResults,
            segmentProgress,
            options,
            productImageUrls,
            continuityWarnings,
            startedAt,
          });
        }),
      );

      const firstFailedSegment = segmentResults
        .filter((segment) => segment?.status === 'failed')
        .sort((a, b) => a.index - b.index)[0];
      const rejected = generationResults.find((result) => result.status === 'rejected');
      if (firstFailedSegment?.error) {
        throw this.toSegmentFailureError(firstFailedSegment);
      }
      if (rejected?.status === 'rejected') {
        throw rejected.reason;
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
      let video = await this.videosRepository.findOne({ where: { taskId: task.id } });
      if (video) {
        video.url = result.video_url;
        video.thumbnailUrl = result.thumbnail_url;
        video.duration = result.duration;
        video.resolution = result.resolution;
        video.aspectRatio = result.aspect_ratio;
        video.fileSize = result.file_size;
        video.exportFormats = [{ format: 'mp4', resolution: result.resolution, quality: 'high' }];
      } else {
        video = this.videosRepository.create({
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
        });
      }
      await this.videosRepository.save(video);
      this.tasksGateway.emitTaskCompleted(task.id, result);
      return { status: 'done', taskId: task.id, result };
    } catch (error) {
      await this.markFailed(taskId, error);
      throw error;
    }
  }

  private async runIndependentSegmentPipeline(input: {
    job: Job<VideoGenerationJob>;
    task: GenerationTask;
    script: Script;
    segment: VideoSegmentPlan;
    segments: VideoSegmentPlan[];
    segmentResults: SegmentResult[];
    segmentProgress: number[];
    options?: VideoOptions;
    productImageUrls: string[];
    continuityWarnings: string[];
    startedAt: number;
  }) {
    const {
      job,
      task,
      script,
      segment,
      segments,
      segmentResults,
      segmentProgress,
      options,
      productImageUrls,
      continuityWarnings,
      startedAt,
    } = input;

    try {
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
      segmentProgress[segment.index] = 0;
      await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
      await this.updateParallelSegmentProgress(
        job,
        segment,
        segments.length,
        segmentProgress,
        'submit_segment',
        startedAt,
      );

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
      segmentProgress[segment.index] = 0.1;
      await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
      await this.updateParallelSegmentProgress(
        job,
        segment,
        segments.length,
        segmentProgress,
        'generate_segment',
        startedAt,
      );

      const providerTask = await this.waitForProviderTask(createdTask.id, async (attempt) => {
        segmentProgress[segment.index] = Math.min(
          0.1 + (attempt / Math.max(this.polling.maxAttempts, 1)) * 0.85,
          0.95,
        );
        await this.updateParallelSegmentProgress(
          job,
          segment,
          segments.length,
          segmentProgress,
          'generate_segment',
          startedAt,
        );
      });
      const segmentStartedAt = segmentResults[segment.index]?.started_at;
      segmentResults[segment.index] = this.toSegmentResult(
        providerTask,
        options,
        segment,
        createdTask.inputFrameUrl,
        createdTask.continuitySource,
        createdTask.id,
        segmentStartedAt,
      );
      segmentProgress[segment.index] = 1;
      await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
      await this.updateParallelSegmentProgress(
        job,
        segment,
        segments.length,
        segmentProgress,
        'generate_segment',
        startedAt,
      );
    } catch (error) {
      const taskError = this.toTaskError(error, segment.index);
      segmentResults[segment.index] = {
        ...(segmentResults[segment.index] ?? this.makeFailedSegmentPlaceholder(segment, options)),
        status: 'failed',
        error: taskError,
        completed_at: new Date().toISOString(),
      };
      segmentProgress[segment.index] = 1;
      await this.persistSegmentState(task, segmentResults, options, continuityWarnings);
      await this.updateParallelSegmentProgress(
        job,
        segment,
        segments.length,
        segmentProgress,
        'generate_segment',
        startedAt,
      );
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
        prompt: buildFirstFramePrompt(script, segment),
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
        `分镜 ${segment.index + 1} Seedream 首帧生成失败；正在使用简化产品优先提示词重试 Seedream：${this.toErrorMessage(error)}`,
      );
    }

    try {
      const generated = await this.volcanoClient.generateFirstFrame({
        prompt: buildFirstFrameRetryPrompt(script, segment),
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
      prompt: buildSegmentVideoPrompt(script, segment, input.continuitySource),
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
      if (segment?.status === 'succeeded' && segment.video_url) {
        reusable[index] = segment;
      }
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

  private makeFailedSegmentPlaceholder(
    segment: VideoSegmentPlan,
    options: VideoOptions | undefined,
  ): SegmentResult {
    return {
      index: segment.index,
      video_url: '',
      thumbnail_url: '',
      duration: segment.duration,
      resolution: options?.resolution ?? this.fromProviderResolution(),
      aspect_ratio: options?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
      scene_orders: segment.scenes.map((scene) => scene.order),
      status: 'failed',
      started_at: new Date().toISOString(),
    };
  }

  private toSegmentFailureError(segment: SegmentResult) {
    const taskError = segment.error;
    const error = new Error(taskError?.message || 'Video generation failed');
    Object.assign(error, {
      code: taskError?.code || 'VIDEO_GENERATION_FAILED',
      retryable: taskError?.retryable,
      segmentIndex: segment.index,
    });
    return error;
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

  private async updateParallelSegmentProgress(
    job: Job<VideoGenerationJob>,
    segment: VideoSegmentPlan,
    segmentTotal: number,
    segmentProgress: number[],
    phase: ProgressPhase,
    startedAt: number,
  ) {
    const completedCount = segmentProgress.filter((ratio) => ratio >= 1).length;
    const averageRatio =
      segmentProgress.reduce((sum, ratio) => sum + Math.min(Math.max(ratio || 0, 0), 1), 0) /
      Math.max(segmentTotal, 1);
    const percentage = Math.round(
      SEGMENT_PROGRESS_START + (SEGMENT_PROGRESS_END - SEGMENT_PROGRESS_START) * averageRatio,
    );
    await this.updateProgress(job, {
      phase,
      percentage,
      message: `正在并行生成 ${segmentTotal} 个镜头，已完成 ${completedCount}/${segmentTotal}`,
      segmentIndex: segment.index + 1,
      segmentTotal,
      elapsedSeconds: this.elapsedSeconds(startedAt),
    });
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
