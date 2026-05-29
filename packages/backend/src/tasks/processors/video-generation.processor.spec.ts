import { VideoGenerationProcessor } from './video-generation.processor';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';

const now = new Date('2026-05-25T00:00:00.000Z');

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    merchantId: 'default',
    productInfo: {
      name: 'Dress',
      description: 'Summer dress',
      category: 'fashion',
      selling_points: ['light'],
      images: ['https://example.com/product.png'],
    },
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

function makeProcessor(
  videoStatus: 'succeeded' | 'failed' | 'running' = 'succeeded',
<<<<<<< HEAD
  options: { videoStatuses?: ('succeeded' | 'failed' | 'running')[]; pollingMaxAttempts?: number; pollingIntervalMs?: number } = {},
=======
  configValues: Record<string, string | undefined> = {},
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
) {
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
      const currentStatus = options.videoStatuses?.shift() ?? videoStatus;
      if (currentStatus === 'failed') {
        return { id: 'volcano-task-1', status: 'failed', error: { code: 'BAD_PROMPT', message: 'bad prompt' } };
      }
      if (currentStatus === 'running') return { id: 'volcano-task-1', status: 'running' };
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
  const configService = {
<<<<<<< HEAD
    get: jest.fn((key: string) => {
      if (key === 'volcano.videoPollingMaxAttempts') return options.pollingMaxAttempts;
      if (key === 'volcano.videoPollingIntervalMs') return options.pollingIntervalMs;
      return undefined;
    }),
=======
    get: jest.fn((key: string) => configValues[key]),
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
  };
  const processor = new VideoGenerationProcessor(
    tasksRepository as never,
    scriptsRepository as never,
    videosRepository as never,
    volcanoClient as never,
    tasksGateway as never,
    configService as never,
  );
  const job = {
    data: { taskId: 'task-1', scriptId: 'script-1', options: { resolution: '1080x1920', aspect_ratio: '9:16' } },
    updateProgress: jest.fn(),
  };
  return { processor, tasksRepository, scriptsRepository, videosRepository, volcanoClient, tasksGateway, configService, job, task };
}

describe('VideoGenerationProcessor', () => {
  it('persists task result, creates video, and emits completion when video succeeds', async () => {
    const { processor, tasksRepository, videosRepository, volcanoClient, tasksGateway, job } = makeProcessor('succeeded');

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('Dress'), ratio: '9:16', duration: 5 }),
    );
    expect(tasksRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    expect(videosRepository.save).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1', scriptId: 'script-1' }));
    expect(tasksGateway.emitTaskCompleted).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ video_url: 'https://example.com/video.mp4' }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 'done', taskId: 'task-1' }));
  });

<<<<<<< HEAD
  it('clamps the target script duration to the 15 second product limit before video generation', async () => {
    const { processor, volcanoClient, job } = makeProcessor('succeeded');
    const longScript = makeScript({ totalDuration: 18 });
    (processor as unknown as { scriptsRepository: { findOne: jest.Mock } }).scriptsRepository.findOne.mockResolvedValueOnce(longScript);

    await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalledWith(expect.objectContaining({ duration: 15 }));
=======
  it('creates one provider request per scene', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        totalDuration: 15,
        scenes: [
          makeScene({ id: 'scene-1', order: 1, duration: 4, description: 'Opening product hero' }),
          makeScene({ id: 'scene-2', order: 2, duration: 7, description: 'Show product details' }),
          makeScene({ id: 'scene-3', order: 3, duration: 4, description: 'Call to action' }),
        ],
      }),
    );

    await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalledTimes(3);
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        duration: 5,
        prompt: expect.stringContaining('Segment scenes: 1'),
        imageUrls: ['https://example.com/product.png'],
        firstFrameUrl: undefined,
      }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        duration: 10,
        prompt: expect.stringContaining('Segment scenes: 2'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/thumb.png',
      }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        duration: 5,
        prompt: expect.stringContaining('Segment scenes: 3'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/thumb.png',
      }),
    );
  });

  it('chains each segment from the previous segment last frame and records continuity metadata', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [
          makeScene({ id: 'scene-1', order: 1, duration: 4 }),
          makeScene({ id: 'scene-2', order: 2, duration: 4 }),
          makeScene({ id: 'scene-3', order: 3, duration: 4 }),
        ],
      }),
    );
    volcanoClient.getVideoTask
      .mockResolvedValueOnce({
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-1.mp4', last_frame_url: 'https://example.com/frame-1.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      })
      .mockResolvedValueOnce({
        id: 'volcano-task-2',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-2.mp4', last_frame_url: 'https://example.com/frame-2.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      })
      .mockResolvedValueOnce({
        id: 'volcano-task-3',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-3.mp4', last_frame_url: 'https://example.com/frame-3.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      });

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ imageUrls: ['https://example.com/product.png'], firstFrameUrl: undefined }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ imageUrls: [], firstFrameUrl: 'https://example.com/frame-1.png' }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ imageUrls: [], firstFrameUrl: 'https://example.com/frame-2.png' }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        segments: [
          expect.objectContaining({ input_frame_url: 'https://example.com/product.png', continuity_source: 'product_image' }),
          expect.objectContaining({ input_frame_url: 'https://example.com/frame-1.png', continuity_source: 'previous_last_frame' }),
          expect.objectContaining({ input_frame_url: 'https://example.com/frame-2.png', continuity_source: 'previous_last_frame' }),
        ],
      }),
    );
  });

  it('falls back to text-only continuity when the previous segment has no last frame', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    volcanoClient.getVideoTask
      .mockResolvedValueOnce({
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-1.mp4', last_frame_url: '' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      })
      .mockResolvedValueOnce({
        id: 'volcano-task-2',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-2.mp4', last_frame_url: 'https://example.com/frame-2.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      });

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ imageUrls: [], firstFrameUrl: undefined }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        continuity_warning: expect.stringContaining('Segment 2'),
        segments: expect.arrayContaining([
          expect.objectContaining({ index: 1, input_frame_url: '', continuity_source: 'text_only' }),
        ]),
      }),
    );
  });

  it('retries previous last frame as a plain image when first-frame role creation is rejected', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    volcanoClient.createVideoTask
      .mockResolvedValueOnce({ id: 'volcano-task-1' })
      .mockRejectedValueOnce(Object.assign(new Error('Volcano video task creation failed: 404'), { status: 404 }))
      .mockResolvedValueOnce({ id: 'volcano-task-2' });
    volcanoClient.getVideoTask
      .mockResolvedValueOnce({
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-1.mp4', last_frame_url: 'https://example.com/frame-1.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      })
      .mockResolvedValueOnce({
        id: 'volcano-task-2',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-2.mp4', last_frame_url: 'https://example.com/frame-2.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      });

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ firstFrameUrl: 'https://example.com/frame-1.png', imageUrls: [] }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ firstFrameUrl: undefined, imageUrls: ['https://example.com/frame-1.png'] }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        continuity_warning: expect.stringContaining('plain image input'),
        segments: expect.arrayContaining([
          expect.objectContaining({
            index: 1,
            input_frame_url: 'https://example.com/frame-1.png',
            continuity_source: 'previous_last_frame',
          }),
        ]),
      }),
    );
  });

  it('falls back to text-only when both first-frame role and plain image retries are rejected', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    volcanoClient.createVideoTask
      .mockResolvedValueOnce({ id: 'volcano-task-1' })
      .mockRejectedValueOnce(Object.assign(new Error('Volcano video task creation failed: 404'), { status: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('Volcano video task creation failed: 400'), { status: 400 }))
      .mockResolvedValueOnce({ id: 'volcano-task-2' });
    volcanoClient.getVideoTask
      .mockResolvedValueOnce({
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-1.mp4', last_frame_url: 'https://example.com/frame-1.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      })
      .mockResolvedValueOnce({
        id: 'volcano-task-2',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-2.mp4', last_frame_url: 'https://example.com/frame-2.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      });

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ firstFrameUrl: undefined, imageUrls: [] }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        continuity_warning: expect.stringContaining('text-only'),
        segments: expect.arrayContaining([
          expect.objectContaining({ index: 1, input_frame_url: '', continuity_source: 'text_only' }),
        ]),
      }),
    );
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
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

<<<<<<< HEAD
  it('uses configured polling attempts when waiting for provider results', async () => {
    const { processor, tasksRepository, tasksGateway, job } = makeProcessor('succeeded', {
      videoStatuses: ['running', 'running', 'succeeded'],
      pollingMaxAttempts: 2,
      pollingIntervalMs: 0,
=======
  it('uses configured polling values for long-running provider tasks', async () => {
    const { processor, volcanoClient, job } = makeProcessor('running', {
      VOLCANO_VIDEO_POLL_ATTEMPTS: '3',
      VOLCANO_VIDEO_POLL_INTERVAL_MS: '1',
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
    });

    await expect(processor.process(job as never)).rejects.toThrow('Video generation timed out');

<<<<<<< HEAD
    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'VIDEO_GENERATION_TIMEOUT' }),
      }),
    );
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ code: 'VIDEO_GENERATION_TIMEOUT' }),
    );
=======
    expect(volcanoClient.getVideoTask).toHaveBeenCalledTimes(3);
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
  });
});
