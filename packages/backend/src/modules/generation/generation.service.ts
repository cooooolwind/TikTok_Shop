import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '../../tasks/queues';

@Injectable()
export class GenerationService {
  constructor(@InjectQueue(QUEUES.VIDEO_GENERATION) private readonly videoQueue: Queue) {}

  create() {
    return { message: 'not implemented' };
  }

  quickCreate() {
    return { message: 'not implemented' };
  }

  findTasks() {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  findTask(taskId: string) {
    return { id: taskId, message: 'not implemented' };
  }

  retry(taskId: string) {
    return { id: taskId, message: 'not implemented' };
  }

  cancel(taskId: string) {
    return { id: taskId, status: 'cancelled' };
  }

  async regenerateScene(taskId: string, sceneId: string) {
    await this.videoQueue.add('regenerate-scene', { taskId, sceneId });
    return { id: taskId, scene_id: sceneId, message: 'not implemented' };
  }

  export(taskId: string) {
    return { task_id: taskId, download_url: 'stub', expires_at: new Date().toISOString() };
  }
}
