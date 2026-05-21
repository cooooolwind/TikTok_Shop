import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUES } from '../queues';

interface VideoGenerationJob {
  taskId: string;
  scriptId: string;
  options?: Record<string, unknown>;
}

/**
 * 视频生成任务处理器 —— 7 步流水线:
 * 1. 验证 + 拉取剧本和分镜
 * 2. 匹配素材到分镜 (向量搜索)
 * 3. 逐分镜生成视觉片段 (Seedance)
 * 4. 逐分镜 TTS 配音
 * 5. 合成片段 + 转场 (FFmpeg)
 * 6. 叠加 BGM + 字幕
 * 7. 最终编码 + 生成缩略图
 */
@Processor(QUEUES.VIDEO_GENERATION)
export class VideoGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoGenerationProcessor.name);

  async process(job: Job<VideoGenerationJob>): Promise<Record<string, unknown>> {
    const { taskId, scriptId } = job.data;
    this.logger.log(`Starting video generation for task=${taskId}, script=${scriptId}`);

    // Step 1: Validate + fetch
    await this.updateProgress(job, 1, 7, 'validating', '正在验证参数...');

    // Step 2: Match materials
    await this.updateProgress(job, 2, 7, 'matching', '正在匹配素材...');

    // Step 3: Generate visual clips
    await this.updateProgress(job, 3, 7, 'generating_clips', '正在生成视觉片段...');

    // Step 4: TTS
    await this.updateProgress(job, 4, 7, 'tts', '正在合成配音...');

    // Step 5: Composite
    await this.updateProgress(job, 5, 7, 'compositing', '正在合成视频...');

    // Step 6: BGM + Subtitles
    await this.updateProgress(job, 6, 7, 'bgm_subtitles', '正在添加配乐和字幕...');

    // Step 7: Final encode
    await this.updateProgress(job, 7, 7, 'encoding', '正在最终编码...');

    return { status: 'done', taskId };
  }

  private async updateProgress(
    job: Job<VideoGenerationJob>,
    currentStep: number,
    totalSteps: number,
    stepName: string,
    message: string,
  ) {
    const progress = {
      current_step: currentStep,
      total_steps: totalSteps,
      step_name: stepName,
      percentage: Math.round((currentStep / totalSteps) * 100),
      message,
      estimated_remaining: (totalSteps - currentStep) * 15,
    };
    await job.updateProgress(progress);
    this.logger.log(`[${currentStep}/${totalSteps}] ${message}`);
  }
}
