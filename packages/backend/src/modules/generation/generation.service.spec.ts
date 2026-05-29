import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationTask } from './entities/generation-task.entity';
import { Video } from './entities/video.entity';
import { Script } from '../scripts/entities/script.entity';

const now = new Date('2026-05-25T00:00:00.000Z');

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    merchantId: 'default',
    productInfo: { name: 'Dress', description: 'Summer dress', category: 'fashion', selling_points: ['light'] },
    templateId: null,
    referenceId: null,
    sourceMaterialIds: [],
    generationTaskId: null,
    generationError: null,
    mode: 'free',
    narrativeFramework: 'Hook - benefits - CTA',
    visualStyle: 'clean',
    totalDuration: 12,
    status: 'confirmed',
    scenes: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: 'task-1',
    scriptId: 'script-1',
    status: 'queued',
    progress: {
      current_step: 0,
      total_steps: 5,
      step_name: 'queued',
      percentage: 0,
      message: 'Queued',
      estimated_remaining: 75,
    },
    result: null as never,
    error: null as never,
    retryCount: 0,
    createdAt: now,
    completedAt: null as never,
    script: makeScript(),
    video: null as never,
    ...overrides,
  };
}

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'video-1',
    taskId: 'task-1',
    merchantId: 'default',
    scriptId: 'script-1',
    url: 'https://example.com/video.mp4',
    thumbnailUrl: '',
    duration: 12,
    resolution: '1080x1920',
    aspectRatio: '9:16',
    fileSize: 123456,
    exportFormats: [],
    createdAt: now,
    task: makeTask(),
    ...overrides,
  };
}

function makeService(options?: {
  script?: Script | null;
  task?: GenerationTask | null;
  video?: Video | null;
  stitched?: { video_url: string; file_size: number };
}) {
  const script = options && 'script' in options ? options.script : makeScript();
  const task = options && 'task' in options ? options.task : makeTask();
  const video = options && 'video' in options ? options.video : makeVideo();
  const stitched = options?.stitched ?? { video_url: '/uploads/generated/task-1.mp4', file_size: 9876 };
  const scriptsRepository = {
    findOne: jest.fn(async () => script),
    find: jest.fn(async () => (script ? [script] : [])),
    save: jest.fn(async (data) => data),
  };
  const tasksRepository = {
    create: jest.fn((data) => makeTask(data)),
    save: jest.fn(async (data) => data),
    findOne: jest.fn(async () => task),
    remove: jest.fn(async (data) => data),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(async () => (task ? [[task], 1] : [[], 0])),
    })),
  };
  const videosRepository = {
    findOne: jest.fn(async () => video),
    save: jest.fn(async (data) => data),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const videoQueue = {
    add: jest.fn(async () => ({ id: 'queue-job-1' })),
  };
  const videoStitchingService = {
    stitch: jest.fn(async () => stitched),
    hasGeneratedVideo: jest.fn(async () => true),
  };
  const service = new GenerationService(
    videoQueue as never,
    tasksRepository as never,
    scriptsRepository as never,
    videosRepository as never,
    videoStitchingService as never,
  );
  return { service, videoQueue, scriptsRepository, tasksRepository, videosRepository, videoStitchingService };
}

describe('GenerationService', () => {
  it('creates a queued video generation task for confirmed scripts', async () => {
    const { service, tasksRepository, videoQueue } = makeService();

    const result = await service.create({ script_id: 'script-1', options: { resolution: '1080x1920' } });

    expect(tasksRepository.save).toHaveBeenCalledWith(expect.objectContaining({ scriptId: 'script-1', status: 'queued' }));
    expect(videoQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ taskId: 'task-1', scriptId: 'script-1' }),
      expect.objectContaining({ attempts: 1 }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'task-1', script_id: 'script-1', status: 'queued' }));
  });

  it('rejects video generation when the script is not confirmed', async () => {
    const { service } = makeService({ script: makeScript({ status: 'draft' }) });

    await expect(service.create({ script_id: 'script-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when the script is missing', async () => {
    const { service } = makeService({ script: null });

    await expect(service.create({ script_id: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('retries failed tasks by incrementing retry count and requeueing', async () => {
    const failedTask = makeTask({ status: 'failed', retryCount: 1 });
    const { service, tasksRepository, videoQueue } = makeService({ task: failedTask });

    const result = await service.retry('task-1');

    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued', retryCount: 2, error: null, completedAt: null }),
    );
    expect(videoQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ taskId: 'task-1', scriptId: 'script-1' }),
      expect.anything(),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'task-1', status: 'queued', retry_count: 2 }));
  });

  it('rejects retry for non-failed tasks', async () => {
    const { service } = makeService({ task: makeTask({ status: 'done' }) });

    await expect(service.retry('task-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exports done task video url as a download url', async () => {
    const doneTask = makeTask({ status: 'done', result: makeVideoResult() });
    const { service } = makeService({ task: doneTask });

    const result = await service.export('task-1');

    expect(result.download_url).toBe('https://example.com/video.mp4');
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(now.getTime());
  });

  it('stitches segmented legacy tasks during export and returns the generated video url', async () => {
    const doneTask = makeTask({ status: 'done', result: makeSegmentedVideoResult() });
    const existingVideo = makeVideo({ url: 'https://example.com/segment-1.mp4', fileSize: 0 });
    const { service, tasksRepository, videosRepository, videoStitchingService } = makeService({
      task: doneTask,
      video: existingVideo,
    });

    const result = await service.export('task-1');

    expect(videoStitchingService.stitch).toHaveBeenCalledWith({
      taskId: 'task-1',
      segments: doneTask.result?.segments,
    });
    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          video_url: '/uploads/generated/task-1.mp4',
          file_size: 9876,
        }),
      }),
    );
    expect(videosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/uploads/generated/task-1.mp4', fileSize: 9876 }),
    );
    expect(result.download_url).toBe('/uploads/generated/task-1.mp4');
  });

  it('restitches segmented tasks when the generated video url points to a missing local file', async () => {
    const doneTask = makeTask({
      status: 'done',
      result: {
        ...makeSegmentedVideoResult(),
        video_url: '/uploads/generated/task-1.mp4',
      },
    });
    const existingVideo = makeVideo({ url: '/uploads/generated/task-1.mp4', fileSize: 0 });
    const { service, videoStitchingService } = makeService({
      task: doneTask,
      video: existingVideo,
    });
    videoStitchingService.hasGeneratedVideo.mockResolvedValueOnce(false);

    const result = await service.export('task-1');

    expect(videoStitchingService.hasGeneratedVideo).toHaveBeenCalledWith('task-1');
    expect(videoStitchingService.stitch).toHaveBeenCalledWith({
      taskId: 'task-1',
      segments: doneTask.result?.segments,
    });
    expect(result.download_url).toBe('/uploads/generated/task-1.mp4');
  });

  it('removes a task and its generated video', async () => {
    const { service, tasksRepository, videosRepository } = makeService();

    await service.remove('task-1');

    expect(videosRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(tasksRepository.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
  });
});

function makeVideoResult() {
  return {
    video_url: 'https://example.com/video.mp4',
    thumbnail_url: '',
    duration: 12,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    file_size: 123456,
  };
}

function makeSegmentedVideoResult() {
  return {
    ...makeVideoResult(),
    video_url: 'https://example.com/segment-1.mp4',
    segments: [
      {
        index: 0,
        video_url: 'https://example.com/segment-1.mp4',
        duration: 6,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        thumbnail_url: '',
        scene_orders: [1],
      },
      {
        index: 1,
        video_url: 'https://example.com/segment-2.mp4',
        duration: 6,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        thumbnail_url: '',
        scene_orders: [2],
      },
    ],
  };
}
