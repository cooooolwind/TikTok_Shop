import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import type {
  CreateVideoRequest,
  GenerationListQuery,
  GenerationTask as GenerationTaskResponse,
  QuickGenerateRequest,
  RegenerateSceneVideoRequest,
} from '@aigc/shared-types';
import { QUEUES } from '../../tasks/queues';
import { Script } from '../scripts/entities/script.entity';
import { GenerationTask } from './entities/generation-task.entity';
import { Video } from './entities/video.entity';
import { VideoStitchingService } from '../../tasks/services/video-stitching.service';

const DEFAULT_PROGRESS = {
  current_step: 0,
  total_steps: 5,
  step_name: 'queued',
  percentage: 0,
  message: '任务已排队，等待开始生成',
  estimated_remaining: 75,
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
  constructor(
    @InjectQueue(QUEUES.VIDEO_GENERATION) private readonly videoQueue: Queue,
    @InjectRepository(GenerationTask) private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Video) private readonly videosRepository: Repository<Video>,
    private readonly videoStitchingService: VideoStitchingService,
  ) {}

  async create(data: CreateVideoRequest): Promise<GenerationTaskResponse> {
    const script = await this.scriptsRepository.findOne({ where: { id: data.script_id }, relations: { scenes: true } });
    if (!script) throw new NotFoundException('Script not found');
    if (script.status !== 'confirmed') {
      throw new BadRequestException('Only confirmed scripts can be used to create videos');
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
    task.result = null;
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
    task.error = { code: 'TASK_CANCELLED', message: 'Task cancelled by user', retryable: true };
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

  async export(taskId: string) {
    const task = await this.findRawTask(taskId);
    if (task.status !== 'done' || !task.result?.video_url) {
      throw new BadRequestException('Only completed tasks can be exported');
    }
    let video = await this.videosRepository.findOne({ where: { taskId } });
    let downloadUrl = video?.url ?? task.result.video_url;

    if (await this.needsExportStitching(task)) {
      try {
        const stitched = await this.videoStitchingService.stitch({
          taskId,
          segments: task.result.segments ?? [],
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
      } catch (error) {
        task.result = {
          ...task.result,
          stitching_warning: this.toErrorMessage(error),
        };
        await this.tasksRepository.save(task);
      }
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return {
      download_url: downloadUrl,
      expires_at: expiresAt.toISOString(),
    };
  }

  private async needsExportStitching(task: GenerationTask) {
    const result = task.result;
    if (!result?.segments || result.segments.length < 2) return false;
    if (!result.video_url.startsWith('/uploads/generated/')) return true;
    return !(await this.videoStitchingService.hasGeneratedVideo(task.id));
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
