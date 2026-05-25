import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { VideoOptions, TaskError, TaskProgress, TaskResult } from '@aigc/shared-types';
import { VolcanoClientProvider, type VolcanoVideoTask } from '../../ai/providers/volcano-client.provider';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Video } from '../../modules/generation/entities/video.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
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

const DEFAULT_POLLING: PollingOptions = {
  maxAttempts: 30,
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
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly tasksGateway: TasksGateway,
  ) {
    super();
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

      await this.updateProgress(job, 1, 5, 'prepare', '正在读取剧本与分镜...');
      const script = await this.findScript(scriptId);
      const duration = Math.min(Math.max(Math.round(Number(script.totalDuration) || 5), 5), 10);

      await this.updateProgress(job, 2, 5, 'build_prompt', '正在整理视频生成提示词...');
      const prompt = this.buildPrompt(script);

      await this.updateProgress(job, 3, 5, 'submit_video_task', '正在提交视频生成任务...');
      const created = await this.volcanoClient.createVideoTask({
        prompt,
        ratio: options?.aspect_ratio ?? this.inferAspectRatio(options?.resolution),
        resolution: this.toProviderResolution(options?.resolution),
        duration,
        imageUrls: script.productInfo.images ?? [],
      });

      await this.updateProgress(job, 4, 5, 'wait_result', '正在等待视频生成结果...');
      const providerTask = await this.waitForProviderTask(created.id);
      const result = this.toTaskResult(providerTask, options, duration);

      await this.updateProgress(job, 5, 5, 'persist_result', '正在保存成片结果...');
      task.status = 'done';
      task.progress = this.makeProgress(5, 5, 'done', '视频生成完成');
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

  private buildPrompt(script: Script) {
    const scenes = [...(script.scenes ?? [])]
      .sort((a, b) => a.order - b.order)
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
      'Create a polished TikTok Shop product video under 15 seconds.',
      `Product: ${script.productInfo.name}`,
      `Category: ${script.productInfo.category}`,
      `Selling points: ${(script.productInfo.selling_points ?? []).join(', ')}`,
      `Visual style: ${script.visualStyle || 'clean product demo'}`,
      `Narrative: ${script.narrativeFramework || 'Hook, benefits, CTA'}`,
      scenes,
      'Keep the product visible, commercially safe, and suitable for e-commerce conversion.',
    ]
      .filter(Boolean)
      .join('\n');
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

  private toTaskResult(providerTask: VolcanoVideoTask, options: VideoOptions | undefined, duration: number): TaskResult {
    const videoUrl = providerTask.content?.video_url || providerTask.content?.file_url || '';
    if (!videoUrl) throw new Error('Video generation succeeded without video_url');

    return {
      video_url: videoUrl,
      thumbnail_url: providerTask.content?.last_frame_url || '',
      duration: providerTask.duration ?? duration,
      resolution: options?.resolution ?? this.fromProviderResolution(providerTask.resolution),
      aspect_ratio: options?.aspect_ratio ?? providerTask.ratio ?? this.inferAspectRatio(options?.resolution),
      file_size: 0,
    };
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

  private inferAspectRatio(resolution?: string) {
    if (resolution === '1920x1080') return '16:9';
    if (resolution === '1080x1080') return '1:1';
    return '9:16';
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
