import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type { VideoOptions, TaskError, TaskProgress, TaskResult } from '@aigc/shared-types';
import {
  VolcanoClientProvider,
  type CreateVideoTaskInput,
  type VolcanoVideoTask,
} from '../../ai/providers/volcano-client.provider';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Video } from '../../modules/generation/entities/video.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';
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

type ContinuitySource = 'product_image' | 'previous_last_frame' | 'text_only';

const SUPPORTED_VIDEO_DURATIONS = [5, 10] as const;
const DEFAULT_POLLING: PollingOptions = {
  maxAttempts: 180,
  intervalMs: 5000,
};
const MAX_TARGET_DURATION_SECONDS = 15;

@Processor(QUEUES.VIDEO_GENERATION)
export class VideoGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoGenerationProcessor.name);
  private polling = DEFAULT_POLLING;

  constructor(
    @InjectRepository(GenerationTask) private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Video) private readonly videosRepository: Repository<Video>,
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly tasksGateway: TasksGateway,
    private readonly configService: ConfigService,
  ) {
    super();
<<<<<<< HEAD
    this.polling = this.resolvePollingOptions();
=======
    this.polling = this.getPollingOptions();
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
  }

  configurePollingForTest(options: PollingOptions) {
    this.polling = options;
  }

  private resolvePollingOptions(): PollingOptions {
    const maxAttempts = this.configService.get<number>('volcano.videoPollingMaxAttempts') ?? DEFAULT_POLLING.maxAttempts;
    const intervalMs = this.configService.get<number>('volcano.videoPollingIntervalMs') ?? DEFAULT_POLLING.intervalMs;
    return {
      maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : DEFAULT_POLLING.maxAttempts,
      intervalMs: Number.isFinite(intervalMs) && intervalMs >= 0 ? Math.floor(intervalMs) : DEFAULT_POLLING.intervalMs,
    };
  }

  async process(job: Job<VideoGenerationJob>): Promise<Record<string, unknown>> {
    const { taskId, scriptId, options } = job.data;
    this.logger.log(`Starting video generation for task=${taskId}, script=${scriptId}`);

    try {
      const task = await this.findTask(taskId);
      task.status = 'processing';
      task.error = null;
      await this.tasksRepository.save(task);

      await this.updateProgress(job, 1, 5, 'prepare', 'Reading script and scenes...');
      const script = await this.findScript(scriptId);
<<<<<<< HEAD
      const duration = this.resolveDuration(script);
=======
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315

      await this.updateProgress(job, 2, 5, 'build_segments', 'Building one video generation segment per scene...');
      const segments = this.buildSegments(script);
      const segmentResults: NonNullable<TaskResult['segments']> = [];
      const continuityWarnings: string[] = [];
      const productImageUrls = script.productInfo.images ?? [];
      let previousLastFrameUrl = '';

      for (const segment of segments) {
        const isFirstSegment = segment.index === 0;
        const firstFrameUrl = isFirstSegment ? undefined : previousLastFrameUrl || undefined;
        const imageUrls = isFirstSegment ? productImageUrls : [];
        const inputFrameUrl = firstFrameUrl ?? (isFirstSegment ? productImageUrls[0] ?? '' : '');
        const continuitySource: ContinuitySource = firstFrameUrl
          ? 'previous_last_frame'
          : isFirstSegment && productImageUrls.length > 0
            ? 'product_image'
            : 'text_only';

        if (!isFirstSegment && !firstFrameUrl) {
          continuityWarnings.push(`Segment ${segment.index + 1} generated without previous last frame input`);
        }

        await this.updateProgress(
          job,
          3,
          5,
          'submit_video_task',
          `Submitting video segment ${segment.index + 1}/${segments.length}...`,
        );
        const createdTask = await this.createVideoTaskForSegment(script, segment, {
          ratio: options?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
          resolution: this.toProviderResolution(options?.resolution),
          duration: segment.duration,
          imageUrls,
          firstFrameUrl,
          inputFrameUrl,
          continuitySource,
          continuityWarnings,
        });

        await this.updateProgress(
          job,
          4,
          5,
          'wait_result',
          `Waiting for video segment ${segment.index + 1}/${segments.length} result...`,
        );
        const providerTask = await this.waitForProviderTask(createdTask.id);
        const segmentResult = this.toSegmentResult(
          providerTask,
          options,
          segment,
          createdTask.inputFrameUrl,
          createdTask.continuitySource,
        );
        segmentResults.push(segmentResult);
        previousLastFrameUrl = segmentResult.thumbnail_url;
      }

      const result = this.toTaskResult(segmentResults, options, continuityWarnings);

      await this.updateProgress(job, 5, 5, 'persist_result', 'Saving segmented video results...');
      task.status = 'done';
      task.progress = this.makeProgress(5, 5, 'done', 'Video segments generated');
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
    const scenes = sortedScenes
      .map((scene) =>
        [
          `Scene ${scene.order}`,
          `visual=${scene.visualPrompt || scene.description || ''}`,
          `camera=${scene.cameraMotion || 'fixed'}`,
          `duration=${scene.duration}s`,
          `voiceover=${scene.dialogue || ''}`,
          `subtitle=${scene.subtitle || ''}`,
          `constraints=${(scene.constraints ?? []).join(', ')}`,
        ].join('; '),
      )
      .join('\n');

    return [
<<<<<<< HEAD
      `Create a polished TikTok Shop product video around ${this.resolveDuration(script)} seconds.`,
=======
      `Create a standalone TikTok Shop product video for scene ${sortedScenes[0]?.order ?? segment.index + 1}.`,
      `This video must be no longer than ${segment.duration} seconds.`,
      continuitySource === 'previous_last_frame'
        ? 'Continue from the provided first frame. Preserve the same product, subject, background, lighting, composition, and visual identity while only performing the current scene action.'
        : continuitySource === 'product_image'
          ? 'Use the provided product image as the visual anchor. Keep the product identity, color, shape, and key details consistent.'
          : 'No image input is available. Keep the product identity and visual style consistent with the script description.',
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
      `Product: ${script.productInfo.name}`,
      `Category: ${script.productInfo.category}`,
      `Selling points: ${(script.productInfo.selling_points ?? []).join(', ')}`,
      `Visual style: ${script.visualStyle || 'clean product demo'}`,
      `Narrative: ${script.narrativeFramework || 'Hook, benefits, CTA'}`,
      `Segment scenes: ${sortedScenes.map((scene) => scene.order).join(', ') || 'single product demo'}`,
      scenes,
      'Generate only this scene, but make it visually continuous with the provided input frame when one is present. Keep the product visible, commercially safe, and suitable for e-commerce conversion.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async createVideoTaskForSegment(
    script: Script,
    segment: VideoSegmentPlan,
    input: {
      ratio: string;
      resolution: string;
      duration: number;
      imageUrls: string[];
      firstFrameUrl?: string;
      inputFrameUrl: string;
      continuitySource: ContinuitySource;
      continuityWarnings: string[];
    },
  ) {
    const create = (overrides: Partial<CreateVideoTaskInput>, continuitySource: ContinuitySource) =>
      this.volcanoClient.createVideoTask({
        prompt: this.buildPrompt(script, segment, continuitySource),
        ratio: input.ratio,
        resolution: input.resolution,
        duration: input.duration,
        imageUrls: input.imageUrls,
        firstFrameUrl: input.firstFrameUrl,
        ...overrides,
      });

    try {
      const created = await create({}, input.continuitySource);
      return { ...created, inputFrameUrl: input.inputFrameUrl, continuitySource: input.continuitySource };
    } catch (error) {
      if (!input.firstFrameUrl || !this.isContinuityInputRejected(error)) throw error;

      input.continuityWarnings.push(
        `Segment ${segment.index + 1} first-frame input was rejected by provider; retried as plain image input`,
      );
    }

    try {
      const created = await create({ firstFrameUrl: undefined, imageUrls: [input.firstFrameUrl] }, 'previous_last_frame');
      return { ...created, inputFrameUrl: input.firstFrameUrl, continuitySource: 'previous_last_frame' as const };
    } catch (error) {
      if (!this.isContinuityInputRejected(error)) throw error;

      input.continuityWarnings.push(
        `Segment ${segment.index + 1} plain image input was rejected by provider; retried as text-only`,
      );
    }

    const created = await create({ firstFrameUrl: undefined, imageUrls: [] }, 'text_only');
    return { ...created, inputFrameUrl: '', continuitySource: 'text_only' as const };
  }

  private isContinuityInputRejected(error: unknown) {
    const maybe = error as { status?: number; code?: string };
    return maybe.status === 400 || maybe.status === 404 || maybe.code === 'InvalidParameter';
  }

  private async waitForProviderTask(providerTaskId: string) {
    for (let attempt = 0; attempt < this.polling.maxAttempts; attempt += 1) {
      const result = await this.volcanoClient.getVideoTask(providerTaskId);
      if (result.status === 'succeeded') return result;
      if (result.status === 'failed' || result.status === 'expired' || result.status === 'cancelled') {
        const error = new Error(result.error?.message || `Video generation ${result.status}`);
        Object.assign(error, {
          code: result.error?.code || `VIDEO_GENERATION_${result.status.toUpperCase()}`,
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

  private async markFailed(taskId: string, error: unknown) {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) return;

    const taskError = this.toTaskError(error);
    task.status = 'failed';
    task.error = taskError;
    task.completedAt = new Date();
    await this.tasksRepository.save(task);
    this.tasksGateway.emitTaskFailed(task.id, taskError);
  }

  private toTaskError(error: unknown): TaskError {
    const maybe = error as { code?: string; message?: string };
    return {
      code: maybe.code || 'VIDEO_GENERATION_FAILED',
      message: maybe.message || 'Video generation failed',
      retryable: true,
    };
  }

  private async updateProgress(
    job: Job<VideoGenerationJob>,
    currentStep: number,
    totalSteps: number,
    stepName: string,
    message: string,
  ) {
    const progress = this.makeProgress(currentStep, totalSteps, stepName, message);
    await job.updateProgress(progress);
    const task = await this.tasksRepository.findOne({ where: { id: job.data.taskId } });
    if (task) {
      task.progress = progress;
      await this.tasksRepository.save(task);
    }
    this.tasksGateway.emitTaskProgress(job.data.taskId, progress);
    this.logger.log(`[${currentStep}/${totalSteps}] ${message}`);
  }

  private makeProgress(currentStep: number, totalSteps: number, stepName: string, message: string): TaskProgress {
    return {
      current_step: currentStep,
      total_steps: totalSteps,
      step_name: stepName,
      percentage: Math.round((currentStep / totalSteps) * 100),
      message,
      estimated_remaining: (totalSteps - currentStep) * 15,
    };
  }

  private resolveDuration(script: Script) {
    return Math.min(Math.max(Math.round(Number(script.totalDuration) || 5), 1), MAX_TARGET_DURATION_SECONDS);
  }

  private inferAspectRatio(resolution?: string) {
    if (resolution === '1920x1080') return '16:9';
    if (resolution === '1080x1080') return '1:1';
    return '9:16';
  }

  private toProviderDuration(duration?: number) {
    const requested = Math.round(Number(duration) || 5);
    return requested <= 5 ? SUPPORTED_VIDEO_DURATIONS[0] : SUPPORTED_VIDEO_DURATIONS[1];
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
