import { VideoGenerationProcessor } from './video-generation.processor';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';

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
    visualStyle: 'clean product demo',
    totalDuration: 12,
    status: 'confirmed',
    scenes: [makeScene()],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    scriptId: 'script-1',
    order: 1,
    description: 'Show the dress fabric',
    cameraMotion: 'push in',
    duration: 4,
    dialogue: 'Light and breathable',
    bgmStyle: 'upbeat',
    subtitle: 'Breathable summer dress',
    visualPrompt: 'Close-up dress fabric',
    constraints: ['show product clearly'],
    createdAt: now,
    updatedAt: now,
    script: null as never,
    ...overrides,
  };
}

function makeTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: 'task-1',
    scriptId: 'script-1',
    status: 'queued',
    progress: null as never,
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

function makeProcessor(videoStatus: 'succeeded' | 'failed' | 'running' = 'succeeded') {
  const task = makeTask();
  const script = makeScript();
  const tasksRepository = {
    findOne: jest.fn(async () => task),
    save: jest.fn(async (data) => data),
  };
  const scriptsRepository = {
    findOne: jest.fn(async () => script),
  };
  const videosRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
  const volcanoClient = {
    createVideoTask: jest.fn(async () => ({ id: 'volcano-task-1' })),
    getVideoTask: jest.fn(async () => {
      if (videoStatus === 'failed') {
        return { id: 'volcano-task-1', status: 'failed', error: { code: 'BAD_PROMPT', message: 'bad prompt' } };
      }
      if (videoStatus === 'running') return { id: 'volcano-task-1', status: 'running' };
      return {
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/video.mp4', last_frame_url: 'https://example.com/thumb.png' },
        duration: 10,
        resolution: '1080p',
        ratio: '9:16',
      };
    }),
  };
  const tasksGateway = {
    emitTaskProgress: jest.fn(),
    emitTaskCompleted: jest.fn(),
    emitTaskFailed: jest.fn(),
  };
  const processor = new VideoGenerationProcessor(
    tasksRepository as never,
    scriptsRepository as never,
    videosRepository as never,
    volcanoClient as never,
    tasksGateway as never,
  );
  const job = {
    data: { taskId: 'task-1', scriptId: 'script-1', options: { resolution: '1080x1920', aspect_ratio: '9:16' } },
    updateProgress: jest.fn(),
  };
  return { processor, tasksRepository, scriptsRepository, videosRepository, volcanoClient, tasksGateway, job, task };
}

describe('VideoGenerationProcessor', () => {
  it('persists task result, creates video, and emits completion when video succeeds', async () => {
    const { processor, tasksRepository, videosRepository, volcanoClient, tasksGateway, job } = makeProcessor('succeeded');

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('Dress'), ratio: '9:16', duration: 10 }),
    );
    expect(tasksRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    expect(videosRepository.save).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1', scriptId: 'script-1' }));
    expect(tasksGateway.emitTaskCompleted).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ video_url: 'https://example.com/video.mp4' }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 'done', taskId: 'task-1' }));
  });

  it('uses supported Seedance duration values for provider requests', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(makeScript({ totalDuration: 15 }));

    await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalledWith(expect.objectContaining({ duration: 10 }));
  });

  it('marks task failed and emits failure when provider returns failed', async () => {
    const { processor, tasksRepository, tasksGateway, job } = makeProcessor('failed');

    await expect(processor.process(job as never)).rejects.toThrow('bad prompt');

    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'BAD_PROMPT', retryable: true }),
      }),
    );
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ code: 'BAD_PROMPT', message: 'bad prompt' }),
    );
  });

  it('marks task failed when provider polling times out', async () => {
    const { processor, tasksRepository, tasksGateway, job } = makeProcessor('running');
    processor.configurePollingForTest({ maxAttempts: 2, intervalMs: 0 });

    await expect(processor.process(job as never)).rejects.toThrow('Video generation timed out');

    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'VIDEO_GENERATION_TIMEOUT', retryable: true }),
      }),
    );
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ code: 'VIDEO_GENERATION_TIMEOUT' }),
    );
  });
});
