import { VideoGenerationProcessor } from './video-generation.processor';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';
import type { VideoStitchingService } from '../services/video-stitching.service';

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
  configValues: Record<string, string | undefined> = {},
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
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };
  const videoStitchingService = {
    stitch: jest.fn(async () => ({
      video_url: '/uploads/generated/task-1.mp4',
      file_size: 12345,
    })),
  };
  const processor = new VideoGenerationProcessor(
    tasksRepository as never,
    scriptsRepository as never,
    videosRepository as never,
    volcanoClient as never,
    tasksGateway as never,
    configService as never,
    videoStitchingService as unknown as VideoStitchingService,
  );
  const job = {
    data: { taskId: 'task-1', scriptId: 'script-1', options: { resolution: '1080x1920', aspect_ratio: '9:16' } },
    updateProgress: jest.fn(),
  };
  return {
    processor,
    tasksRepository,
    scriptsRepository,
    videosRepository,
    volcanoClient,
    tasksGateway,
    configService,
    videoStitchingService,
    job,
    task,
  };
}

describe('VideoGenerationProcessor', () => {
  it('persists task result, creates video, and emits completion when video succeeds', async () => {
    const { processor, tasksRepository, videosRepository, volcanoClient, tasksGateway, videoStitchingService, job } =
      makeProcessor('succeeded');

    const result = await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('Dress'), ratio: '9:16', duration: 4 }),
    );
    expect(tasksRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    expect(videosRepository.save).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1', scriptId: 'script-1' }));
    expect(tasksGateway.emitTaskCompleted).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ video_url: 'https://example.com/video.mp4' }),
    );
    expect(videoStitchingService.stitch).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ status: 'done', taskId: 'task-1' }));
  });

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
        duration: 4,
        prompt: expect.stringContaining('Visual action:'),
        imageUrls: ['https://example.com/product.png'],
        firstFrameUrl: undefined,
      }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        prompt: expect.stringContaining('Close-up dress fabric'),
      }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        duration: 7,
        prompt: expect.stringContaining('Visual action:'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/thumb.png',
      }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        duration: 4,
        prompt: expect.stringContaining('Visual action:'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/thumb.png',
      }),
    );
  });

  it('uses scene-first prompts without narrative wrappers or legacy duration fields', async () => {
    const { processor, volcanoClient, job } = makeProcessor('succeeded');

    await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalled();
    const firstCreateCall = volcanoClient.createVideoTask.mock.calls[0] as unknown as [{ prompt: string }];
    const prompt = firstCreateCall[0].prompt;
    expect(prompt).toContain('Visual action:');
    expect(prompt).toContain('Close-up dress fabric');
    expect(prompt).toContain('Output duration: 4 seconds.');
    expect(prompt).not.toContain('Narrative:');
    expect(prompt).not.toContain('Segment scenes:');
    expect(prompt).not.toContain('duration=4s');
  });

  it('clamps provider durations to the Seedance 1.5 pro 4-12 second range', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [
          makeScene({ id: 'scene-1', order: 1, duration: 2 }),
          makeScene({ id: 'scene-2', order: 2, duration: 13 }),
        ],
      }),
    );

    await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(1, expect.objectContaining({ duration: 4 }));
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ duration: 12 }));
  });

  it('stitches multiple generated segments and persists the stitched video as the primary result', async () => {
    const { processor, scriptsRepository, volcanoClient, videosRepository, videoStitchingService, tasksGateway, job } =
      makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    volcanoClient.getVideoTask
      .mockResolvedValueOnce({
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-1.mp4', last_frame_url: 'https://example.com/frame-1.png' },
        duration: 4,
        resolution: '1080p',
        ratio: '9:16',
      })
      .mockResolvedValueOnce({
        id: 'volcano-task-2',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-2.mp4', last_frame_url: 'https://example.com/frame-2.png' },
        duration: 4,
        resolution: '1080p',
        ratio: '9:16',
      });

    const result = await processor.process(job as never);

    expect(videoStitchingService.stitch).toHaveBeenCalledWith({
      taskId: 'task-1',
      segments: [
        expect.objectContaining({ video_url: 'https://example.com/segment-1.mp4' }),
        expect.objectContaining({ video_url: 'https://example.com/segment-2.mp4' }),
      ],
    });
    expect(result.result).toEqual(
      expect.objectContaining({
        video_url: '/uploads/generated/task-1.mp4',
        file_size: 12345,
        segments: expect.arrayContaining([
          expect.objectContaining({ video_url: 'https://example.com/segment-1.mp4' }),
          expect.objectContaining({ video_url: 'https://example.com/segment-2.mp4' }),
        ]),
      }),
    );
    expect(videosRepository.save).toHaveBeenCalledWith(expect.objectContaining({ url: '/uploads/generated/task-1.mp4' }));
    expect(tasksGateway.emitTaskCompleted).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ video_url: '/uploads/generated/task-1.mp4' }),
    );
  });

  it('keeps segmented results when stitching fails and records a stitching warning', async () => {
    const { processor, scriptsRepository, volcanoClient, videoStitchingService, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    videoStitchingService.stitch.mockRejectedValueOnce(new Error('ffmpeg exited with code 1: invalid data'));
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

    expect(result.result).toEqual(
      expect.objectContaining({
        video_url: 'https://example.com/segment-1.mp4',
        stitching_warning: 'ffmpeg exited with code 1: invalid data',
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

  it('uses configured polling values for long-running provider tasks', async () => {
    const { processor, volcanoClient, job } = makeProcessor('running', {
      VOLCANO_VIDEO_POLL_ATTEMPTS: '3',
      VOLCANO_VIDEO_POLL_INTERVAL_MS: '1',
    });

    await expect(processor.process(job as never)).rejects.toThrow('Video generation timed out');

    expect(volcanoClient.getVideoTask).toHaveBeenCalledTimes(3);
  });
});
