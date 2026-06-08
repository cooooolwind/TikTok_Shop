import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import type {
  CreateVideoRequest,
  ExportRequest,
  GenerationListQuery,
  GenerationTask as GenerationTaskResponse,
  QuickGenerateRequest,
  RegenerateSceneVideoRequest,
  TaskProgress,
  TaskResult,
} from '@aigc/shared-types';
import { QUEUES } from '../../tasks/queues';
import { Script } from '../scripts/entities/script.entity';
import { Material } from '../materials/entities/material.entity';
import { GenerationTask } from './entities/generation-task.entity';
import { Video } from './entities/video.entity';
import { VideoStitchingService } from '../../tasks/services/video-stitching.service';
import { RemotionRenderingService } from './remotion-rendering.service';
import { SubtitlesService } from './subtitles.service';

const DEFAULT_PROGRESS: TaskProgress = {
  current_step: 0,
  total_steps: 5,
  step_name: 'queued',
  percentage: 0,
  message: '任务已排队，等待开始生成',
  estimated_remaining: 75,
  phase: 'queued',
  phase_label: '排队中',
};

const BEIJING_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  hour12: false,
});

function getBeijingCompactParts(date: Date) {
  const parts = Object.fromEntries(
    BEIJING_DATE_TIME_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function toScriptDisplayId(createdAt?: Date) {
  if (!createdAt) return undefined;
  const parts = getBeijingCompactParts(createdAt);
  return `JB${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectQueue(QUEUES.VIDEO_GENERATION) private readonly videoQueue: Queue,
    @InjectRepository(GenerationTask) private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Video) private readonly videosRepository: Repository<Video>,
    @InjectRepository(Material) private readonly materialsRepository: Repository<Material>,
    private readonly videoStitchingService: VideoStitchingService,
    private readonly remotionRenderingService: RemotionRenderingService,
    private readonly subtitlesService: SubtitlesService,
  ) {}

  async create(data: CreateVideoRequest): Promise<GenerationTaskResponse> {
    const script = await this.scriptsRepository.findOne({ where: { id: data.script_id }, relations: { scenes: true } });
    if (!script) throw new NotFoundException('Script not found');
    if (script.status !== 'confirmed') {
      throw new BadRequestException('Only confirmed scripts can be used to create videos');
    }
    if (!(await this.hasProductImageInput(script))) {
      throw new BadRequestException({
        code: 'PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME',
        message: '请先为剧本补充商品图，再生成视频。Seedream 首帧生成需要商品图作为参考输入。',
        retryable: true,
        user_action: '请回到剧本生成页或素材库上传/选择商品图后重试。',
      });
    }

    const task = await this.tasksRepository.save(
      this.tasksRepository.create({
        scriptId: script.id,
        status: 'queued',
        progress: DEFAULT_PROGRESS,
        result: null,
        error: null,
        retryCount: 0,
        completedAt: null,
      }),
    );
    task.script = script;
    await this.enqueue(task.id, script.id, data.options);
    return this.toTaskResponse(task);
  }

  async quickCreate(_data: QuickGenerateRequest) {
    throw new BadRequestException('Quick generation requires script generation orchestration and is not available in this endpoint yet');
  }

  async findTasks(query: GenerationListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.max(Number(query.pageSize ?? 20), 1);
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .orderBy('task.created_at', query.sortOrder === 'asc' ? 'ASC' : 'DESC');

    if (query.status) qb.andWhere('task.status = :status', { status: query.status });
    if (query.script_id) qb.andWhere('task.script_id = :scriptId', { scriptId: query.script_id });

    const [tasks, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const scriptsById = await this.findScriptsByTaskScriptId(tasks);

    return {
      items: tasks.map((task) => this.toTaskResponse(task, scriptsById.get(task.scriptId))),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findTask(taskId: string) {
    const task = await this.findRawTask(taskId);
    const script = await this.scriptsRepository.findOne({ where: { id: task.scriptId } });
    return this.toTaskResponse(task, script ?? undefined);
  }

  async retry(taskId: string) {
    const task = await this.findRawTask(taskId);
    if (task.status !== 'failed') throw new BadRequestException('Only failed tasks can be retried');

    task.status = 'queued';
    task.progress = DEFAULT_PROGRESS;
    task.error = null;
    task.result = this.prepareResultForRetry(task.result);
    task.completedAt = null;
    task.retryCount += 1;
    const saved = await this.tasksRepository.save(task);
    await this.enqueue(saved.id, saved.scriptId);
    return this.toTaskResponse(saved);
  }

  async cancel(taskId: string) {
    const task = await this.findRawTask(taskId);
    if (task.status !== 'queued' && task.status !== 'processing') {
      throw new BadRequestException('Only queued or processing tasks can be cancelled');
    }
    task.status = 'failed';
    task.error = {
      code: 'TASK_CANCELLED',
      message: 'Task cancelled by user',
      retryable: true,
      category: 'unknown',
      user_action: '可以重新重试任务，已生成的分镜片段会尽量保留。',
    };
    task.completedAt = new Date();
    return this.toTaskResponse(await this.tasksRepository.save(task));
  }

  async remove(taskId: string) {
    const task = await this.findRawTask(taskId);
    await this.videosRepository.delete({ taskId });
    await this.tasksRepository.remove(task);
    return { message: 'deleted' };
  }

  async regenerateScene(taskId: string, sceneId: string, data: RegenerateSceneVideoRequest = {}) {
    const task = await this.findRawTask(taskId);
    await this.videoQueue.add('regenerate-scene', { taskId, sceneId, instruction: data.instruction, materialId: data.material_id });
    return this.toTaskResponse(task);
  }

  async export(taskId: string, data: ExportRequest = { format: 'mp4', resolution: '1080x1920', quality: 'high' }) {
    const task = await this.findRawTask(taskId);
    if (task.status !== 'done' || !task.result?.video_url) {
      throw new BadRequestException('Only completed tasks can be exported');
    }
    if (data.render_engine === 'remotion') {
      this.logger.log(`Exporting task=${taskId} with Remotion transition renderer`);
      return this.exportWithRemotion(task, data);
    }

    const subtitleProject = await this.subtitlesService.getProject(taskId).catch(() => undefined);
    if (subtitleProject?.cues.length && (task.result.segments ?? []).some((segment) => segment.video_url)) {
      this.logger.log(`Exporting task=${taskId} with Remotion subtitle renderer`);
      return this.exportWithRemotion(task, {
        ...data,
        render_engine: 'remotion',
        transition: { type: 'none', duration_frames: 6 },
        edit_project: this.createDefaultEditProject(task.result, subtitleProject.cues),
      });
    }

    let video = await this.videosRepository.findOne({ where: { taskId } });
    let downloadUrl = task.result.video_url || video?.url;
    let source: 'segment' | 'stitched' = this.isGeneratedVideoUrl(downloadUrl) ? 'stitched' : 'segment';

    if (await this.needsExportStitching(task)) {
      try {
        const stitched = await this.videoStitchingService.stitch({
          taskId,
          segments: (task.result.segments ?? []).filter((segment) => segment.status !== 'failed'),
        });

        task.result = {
          ...task.result,
          video_url: stitched.video_url,
          file_size: stitched.file_size,
          stitching_warning: undefined,
        };
        await this.tasksRepository.save(task);

        if (video) {
          video.url = stitched.video_url;
          video.fileSize = stitched.file_size;
          video = await this.videosRepository.save(video);
        }

        downloadUrl = stitched.video_url;
        source = 'stitched';
      } catch (error) {
        throw new BadRequestException({
          code: 'VIDEO_EXPORT_STITCHING_FAILED',
          message: `完整视频拼接失败，分段视频仍可预览：${this.toErrorMessage(error)}`,
          retryable: true,
          category: 'export',
          user_action: '请稍后重试导出，或先使用分段视频预览。',
        });
      }
    }

    if (!downloadUrl) throw new BadRequestException('No generated video is available for export');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return {
      download_url: downloadUrl,
      expires_at: expiresAt.toISOString(),
      source,
      segments_count: task.result.segments?.length ?? 1,
    };
  }

  private async exportWithRemotion(task: GenerationTask, data: ExportRequest) {
    const currentResult = task.result;
    if (!currentResult) throw new BadRequestException('No generated video is available for export');

    const segments = (currentResult.segments ?? []).filter((segment) => segment.status !== 'failed');
    if (segments.length < 1) {
      throw new BadRequestException('At least one video segment is required for Remotion export');
    }

    let video = await this.videosRepository.findOne({ where: { taskId: task.id } });
    try {
      const rendered = await this.remotionRenderingService.render({
        taskId: task.id,
        segments,
        resolution: data.resolution ?? currentResult.resolution ?? '1080x1920',
        transition: data.transition,
        editProject: data.edit_project,
      });

      task.result = {
        ...currentResult,
        video_url: rendered.video_url,
        file_size: rendered.file_size,
        render_engine: 'remotion',
        stitching_warning: undefined,
      };
      await this.tasksRepository.save(task);

      if (video) {
        video.url = rendered.video_url;
        video.fileSize = rendered.file_size;
        video = await this.videosRepository.save(video);
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return {
        download_url: rendered.video_url,
        expires_at: expiresAt.toISOString(),
        source: 'remotion' as const,
        segments_count: segments.length,
      };
    } catch (error) {
      throw new BadRequestException({
        code: 'VIDEO_EXPORT_REMOTION_FAILED',
        message: `转场视频导出失败，分段视频仍可预览：${this.toErrorMessage(error)}`,
        retryable: true,
        category: 'export',
        user_action: '请稍后重试转场导出，或先使用普通导出生成完整视频。',
      });
    }
  }

  private async needsExportStitching(task: GenerationTask) {
    const result = task.result;
    if (!result?.segments || result.segments.length < 2) return false;
    if (!this.isGeneratedVideoUrl(result.video_url)) return true;
    return !(await this.videoStitchingService.hasGeneratedVideo(task.id));
  }

  private isGeneratedVideoUrl(url?: string) {
    return Boolean(url?.startsWith('/uploads/generated/'));
  }

  private createDefaultEditProject(result: TaskResult, subtitles: NonNullable<ExportRequest['edit_project']>['subtitles']) {
    return {
      clips: (result.segments ?? [])
        .filter((segment) => segment.status !== 'failed' && segment.video_url)
        .sort((a, b) => a.index - b.index)
        .map((segment) => ({
          id: `clip-${segment.index}`,
          segment_index: segment.index,
          start_seconds: 0,
          end_seconds: segment.duration,
        })),
      transitions: [],
      subtitles,
    };
  }

  private prepareResultForRetry(result: TaskResult | null): TaskResult | null {
    if (!result?.segments?.length) return null;
    const preservedSegments = result.segments
      .filter((segment) => segment.status === 'succeeded' && segment.video_url)
      .sort((a, b) => a.index - b.index);
    if (preservedSegments.length === 0) return null;
    const first = preservedSegments[0];
    return {
      video_url: first.video_url,
      thumbnail_url: first.thumbnail_url,
      duration: preservedSegments.reduce((sum, segment) => sum + segment.duration, 0),
      resolution: first.resolution,
      aspect_ratio: first.aspect_ratio,
      file_size: 0,
      continuity_warning: result.continuity_warning,
      segments: preservedSegments,
    };
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private async enqueue(taskId: string, scriptId: string, options?: CreateVideoRequest['options']) {
    await this.videoQueue.add(
      'generate',
      { taskId, scriptId, options },
      { attempts: 1, removeOnComplete: true, removeOnFail: false },
    );
  }

  private async hasProductImageInput(script: Script) {
    if ((script.productInfo.images ?? []).some((url) => Boolean(url))) return true;
    const materialIds = script.sourceMaterialIds ?? [];
    if (materialIds.length === 0) return false;
    const materials = await this.materialsRepository.findBy({ id: In(materialIds), merchantId: script.merchantId });
    return materials.some((material) => material.type === 'image' && Boolean(material.url));
  }

  private async findRawTask(taskId: string) {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Generation task not found');
    return task;
  }

  private async findScriptsByTaskScriptId(tasks: GenerationTask[]) {
    const scriptIds = [...new Set(tasks.map((task) => task.scriptId).filter(Boolean))];
    if (scriptIds.length === 0) return new Map<string, Script>();
    const scripts = await this.scriptsRepository.find({ where: { id: In(scriptIds) } });
    return new Map(scripts.map((script) => [script.id, script]));
  }

  private toTaskResponse(task: GenerationTask, script?: Script): GenerationTaskResponse {
    const scriptDisplayId = toScriptDisplayId(script?.createdAt ?? task.script?.createdAt);
    const taskParts = getBeijingCompactParts(task.createdAt);
    return {
      id: task.id,
      display_id: scriptDisplayId
        ? `${scriptDisplayId}-SP${taskParts.hour}${taskParts.minute}`
        : `SP${taskParts.year}${taskParts.month}${taskParts.day}-${taskParts.hour}${taskParts.minute}`,
      script_id: task.scriptId,
      script_display_id: scriptDisplayId,
      status: task.status,
      progress: task.progress ?? DEFAULT_PROGRESS,
      result: task.result ?? undefined,
      error: task.error ?? undefined,
      retry_count: task.retryCount,
      created_at: task.createdAt.toISOString(),
      completed_at: task.completedAt?.toISOString(),
    };
  }
}
