import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
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

const DEFAULT_PROGRESS = {
  current_step: 0,
  total_steps: 5,
  step_name: 'queued',
  percentage: 0,
  message: '任务已排队，等待开始生成',
  estimated_remaining: 75,
};

@Injectable()
export class GenerationService {
  constructor(
    @InjectQueue(QUEUES.VIDEO_GENERATION) private readonly videoQueue: Queue,
    @InjectRepository(GenerationTask) private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Video) private readonly videosRepository: Repository<Video>,
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

    return {
      items: tasks.map((task) => this.toTaskResponse(task)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findTask(taskId: string) {
    return this.toTaskResponse(await this.findRawTask(taskId));
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
    if (task.status === 'queued' || task.status === 'processing') {
      throw new BadRequestException('Active generation tasks must be cancelled before deletion');
    }

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
    const video = await this.videosRepository.findOne({ where: { taskId } });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return {
      download_url: video?.url ?? task.result.video_url,
      expires_at: expiresAt.toISOString(),
    };
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

  private toTaskResponse(task: GenerationTask): GenerationTaskResponse {
    return {
      id: task.id,
      script_id: task.scriptId,
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
