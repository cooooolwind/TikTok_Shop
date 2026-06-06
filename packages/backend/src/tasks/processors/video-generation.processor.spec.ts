import { VideoGenerationProcessor } from './video-generation.processor';
import { GenerationTask } from '../../modules/generation/entities/generation-task.entity';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';
import { promises as fsPromises } from 'fs';

const now = new Date('2026-05-25T00:00:00.000Z');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises(times = 5) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

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
  configValues: Record<string, unknown> = {},
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
  const materialsRepository = {
    findBy: jest.fn(async () => []),
  };
  const videosRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
  let firstFrameIndex = 0;
  const volcanoClient = {
    generateFirstFrame: jest.fn(async ({ prompt }: { prompt: string }) => {
      firstFrameIndex += 1;
      return {
        url: `https://example.com/first-frame-${firstFrameIndex}.png`,
        prompt,
      };
    }),
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
    materialsRepository as never,
    volcanoClient as never,
    tasksGateway as never,
    configService as never,
  );
  const job = {
    data: { taskId: 'task-1', scriptId: 'script-1', options: { resolution: '1080x1920', aspect_ratio: '9:16' } },
    updateProgress: jest.fn(),
  };
  return {
    processor,
    tasksRepository,
    scriptsRepository,
    materialsRepository,
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('creates one Seedream first frame and one provider request per scene', async () => {
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

    expect(volcanoClient.generateFirstFrame).toHaveBeenCalledTimes(3);
    expect(volcanoClient.generateFirstFrame).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ size: '1600x2848' }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenCalledTimes(3);
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        duration: 4,
        prompt: expect.stringContaining('视觉动作：'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/first-frame-1.png',
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
        prompt: expect.stringContaining('视觉动作：'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/first-frame-2.png',
      }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        duration: 4,
        prompt: expect.stringContaining('视觉动作：'),
        imageUrls: [],
        firstFrameUrl: 'https://example.com/first-frame-3.png',
      }),
    );
  });

  it('starts all independent segment pipelines before waiting for earlier first frames', async () => {
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
    const firstFrames = [
      deferred<{ url: string; prompt: string }>(),
      deferred<{ url: string; prompt: string }>(),
      deferred<{ url: string; prompt: string }>(),
    ];
    volcanoClient.generateFirstFrame.mockImplementation((input: { prompt: string }) => {
      const next = firstFrames[volcanoClient.generateFirstFrame.mock.calls.length - 1];
      return next.promise.then((result) => ({ ...result, prompt: input.prompt }));
    });
    volcanoClient.createVideoTask.mockImplementation(async () => ({
      id: `volcano-task-${volcanoClient.createVideoTask.mock.calls.length}`,
    }));
    volcanoClient.getVideoTask.mockImplementation(async ({ id }: { id?: string } = {} as never) => ({
      id: id ?? 'volcano-task',
      status: 'succeeded',
      content: { video_url: `https://example.com/${id ?? 'video'}.mp4`, last_frame_url: 'https://example.com/thumb.png' },
      duration: 4,
      resolution: '1080p',
      ratio: '9:16',
    }));

    const processPromise = processor.process(job as never);
    await flushPromises();

    expect(volcanoClient.generateFirstFrame).toHaveBeenCalledTimes(3);

    firstFrames.forEach((item, index) => {
      item.resolve({ url: `https://example.com/first-frame-${index + 1}.png`, prompt: 'first frame' });
    });
    await expect(processPromise).resolves.toEqual(expect.objectContaining({ status: 'done' }));
  });

  it('uses Seedream image sizes that satisfy the provider minimum pixel count', async () => {
    const vertical = makeProcessor('succeeded');
    await vertical.processor.process(vertical.job as never);
    expect(vertical.volcanoClient.generateFirstFrame).toHaveBeenCalledWith(
      expect.objectContaining({ size: '1600x2848' }),
    );

    const landscape = makeProcessor('succeeded');
    landscape.job.data.options = { resolution: '1920x1080', aspect_ratio: '16:9' };
    await landscape.processor.process(landscape.job as never);
    expect(landscape.volcanoClient.generateFirstFrame).toHaveBeenCalledWith(
      expect.objectContaining({ size: '2848x1600' }),
    );

    const square = makeProcessor('succeeded');
    square.job.data.options = { resolution: '1080x1080', aspect_ratio: '1:1' };
    await square.processor.process(square.job as never);
    expect(square.volcanoClient.generateFirstFrame).toHaveBeenCalledWith(
      expect.objectContaining({ size: '1920x1920' }),
    );
  });

  it('records generated first-frame continuity metadata for each segment', async () => {
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
      expect.objectContaining({ imageUrls: [], firstFrameUrl: 'https://example.com/first-frame-1.png' }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ imageUrls: [], firstFrameUrl: 'https://example.com/first-frame-2.png' }),
    );
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ imageUrls: [], firstFrameUrl: 'https://example.com/first-frame-3.png' }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        segments: [
          expect.objectContaining({ input_frame_url: 'https://example.com/first-frame-1.png', continuity_source: 'generated_first_frame' }),
          expect.objectContaining({ input_frame_url: 'https://example.com/first-frame-2.png', continuity_source: 'generated_first_frame' }),
          expect.objectContaining({ input_frame_url: 'https://example.com/first-frame-3.png', continuity_source: 'generated_first_frame' }),
        ],
      }),
    );
  });

  it('当首帧生成失败时使用简化提示词重试 Seedream', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    volcanoClient.generateFirstFrame
      .mockResolvedValueOnce({ url: 'https://example.com/first-frame-1.png', prompt: 'first frame' })
      .mockRejectedValueOnce(new Error('Seedream failed'))
      .mockResolvedValueOnce({ url: 'https://example.com/first-frame-retry.png', prompt: 'retry first frame' });

    const result = await processor.process(job as never);

    expect(volcanoClient.generateFirstFrame).toHaveBeenCalledTimes(3);
    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        firstFrameUrl: 'https://example.com/first-frame-retry.png',
        imageUrls: [],
      }),
    );
    expect(volcanoClient.createVideoTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameUrl: 'https://example.com/product.png',
      }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        continuity_warning: expect.stringContaining('使用简化产品优先提示词重试 Seedream'),
        segments: expect.arrayContaining([
          expect.objectContaining({
            index: 1,
            input_frame_url: 'https://example.com/first-frame-retry.png',
            continuity_source: 'generated_first_frame',
          }),
        ]),
      }),
    );
  });

  it('fails without sending raw product images to Seedance when Seedream cannot generate a first frame', async () => {
    const { processor, volcanoClient, scriptsRepository, tasksRepository, tasksGateway, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 })],
      }),
    );
    volcanoClient.generateFirstFrame
      .mockRejectedValueOnce(new Error('Seedream primary failed'))
      .mockRejectedValueOnce(new Error('Seedream retry failed'));

    await expect(processor.process(job as never)).rejects.toThrow('SEEDREAM_FIRST_FRAME_GENERATION_FAILED');

    expect(volcanoClient.createVideoTask).not.toHaveBeenCalled();
    expect(volcanoClient.createVideoTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameUrl: 'https://example.com/product.png',
      }),
    );
    expect(volcanoClient.createVideoTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['https://example.com/product.png'],
      }),
    );
    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'SEEDREAM_FIRST_FRAME_GENERATION_FAILED' }),
      }),
    );
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ code: 'SEEDREAM_FIRST_FRAME_GENERATION_FAILED' }),
    );
  });

  it('fails clearly when Seedream first-frame generation fails without product images', async () => {
    const { processor, volcanoClient, scriptsRepository, tasksRepository, tasksGateway, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        productInfo: {
          name: 'Dress',
          description: 'Summer dress',
          category: 'fashion',
          selling_points: ['light'],
          images: [],
        },
        scenes: [makeScene({ id: 'scene-1', order: 1 })],
      }),
    );
    volcanoClient.generateFirstFrame.mockRejectedValueOnce(new Error('Seedream failed'));

    await expect(processor.process(job as never)).rejects.toThrow('PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME');

    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME' }),
      }),
    );
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ code: 'PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME' }),
    );
  });

  it('converts local uploaded product image urls to data urls before calling Seedream', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded', {
      storage: { localPath: 'uploads-test' } as never,
    });
    jest.spyOn(fsPromises, 'readFile').mockResolvedValue(Buffer.from('image-bytes'));
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        productInfo: {
          name: 'Dress',
          description: 'Summer dress',
          category: 'fashion',
          selling_points: ['light'],
          images: ['/uploads/materials/product.jpg'],
        },
        scenes: [makeScene({ id: 'scene-1', order: 1 })],
      }),
    );

    await processor.process(job as never);

    expect(volcanoClient.generateFirstFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImages: ['data:image/jpeg;base64,aW1hZ2UtYnl0ZXM='],
      }),
    );
  });

  it('does not submit unreadable local product image urls to Seedream', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded', {
      storage: { localPath: 'uploads-test' } as never,
    });
    jest.spyOn(fsPromises, 'readFile').mockRejectedValue(new Error('missing file'));
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        productInfo: {
          name: 'Dress',
          description: 'Summer dress',
          category: 'fashion',
          selling_points: ['light'],
          images: ['/uploads/materials/missing.jpg'],
        },
        scenes: [makeScene({ id: 'scene-1', order: 1 })],
      }),
    );

    await expect(processor.process(job as never)).rejects.toThrow('PRODUCT_IMAGE_REQUIRED_FOR_FIRST_FRAME');

    expect(volcanoClient.generateFirstFrame).not.toHaveBeenCalled();
  });

  it('使用场景优先提示词，不含叙事包装或旧版时长字段', async () => {
    const { processor, volcanoClient, job } = makeProcessor('succeeded');

    await processor.process(job as never);

    expect(volcanoClient.createVideoTask).toHaveBeenCalled();
    const firstCreateCall = volcanoClient.createVideoTask.mock.calls[0] as unknown as [{ prompt: string }];
    const prompt = firstCreateCall[0].prompt;
    expect(prompt).toContain('视觉动作：');
    expect(prompt).toContain('Close-up dress fabric');
    expect(prompt).toContain('输出时长：4 秒。');
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

  it('keeps multiple generated segments without stitching during generation', async () => {
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

    expect(videoStitchingService.stitch).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        video_url: 'https://example.com/segment-1.mp4',
        file_size: 0,
        segments: expect.arrayContaining([
          expect.objectContaining({ video_url: 'https://example.com/segment-1.mp4', status: 'succeeded' }),
          expect.objectContaining({ video_url: 'https://example.com/segment-2.mp4', status: 'succeeded' }),
        ]),
      }),
    );
    expect(videosRepository.save).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/segment-1.mp4' }));
    expect(tasksGateway.emitTaskCompleted).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ video_url: 'https://example.com/segment-1.mp4' }),
    );
  });

  it('does not run stitching or write stitching warnings during generation', async () => {
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
        segments: expect.arrayContaining([
          expect.objectContaining({ video_url: 'https://example.com/segment-1.mp4' }),
          expect.objectContaining({ video_url: 'https://example.com/segment-2.mp4' }),
        ]),
      }),
    );
    expect(result.result).not.toHaveProperty('stitching_warning');
    expect(videoStitchingService.stitch).not.toHaveBeenCalled();
  });

  it('fails when the generated first-frame input is rejected by the video provider', async () => {
    const { processor, volcanoClient, scriptsRepository, job } = makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [makeScene({ id: 'scene-1', order: 1 }), makeScene({ id: 'scene-2', order: 2 })],
      }),
    );
    volcanoClient.createVideoTask
      .mockResolvedValueOnce({ id: 'volcano-task-1' })
      .mockRejectedValueOnce(Object.assign(new Error('Volcano video task creation failed: 404'), { status: 404 }));
    volcanoClient.getVideoTask
      .mockResolvedValueOnce({
        id: 'volcano-task-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/segment-1.mp4', last_frame_url: 'https://example.com/frame-1.png' },
        duration: 5,
        resolution: '1080p',
        ratio: '9:16',
      });

    await expect(processor.process(job as never)).rejects.toThrow('Volcano video task creation failed: 404');

    expect(volcanoClient.createVideoTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ firstFrameUrl: 'https://example.com/first-frame-2.png', imageUrls: [] }),
    );
    expect(volcanoClient.createVideoTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameUrl: 'https://example.com/product.png',
      }),
    );
    expect(volcanoClient.createVideoTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['https://example.com/product.png'],
      }),
    );
  });

  it('keeps successful parallel segments when another segment fails', async () => {
    const { processor, volcanoClient, scriptsRepository, tasksRepository, tasksGateway, job, task } =
      makeProcessor('succeeded');
    scriptsRepository.findOne.mockResolvedValue(
      makeScript({
        scenes: [
          makeScene({ id: 'scene-1', order: 1, duration: 4 }),
          makeScene({ id: 'scene-2', order: 2, duration: 4 }),
          makeScene({ id: 'scene-3', order: 3, duration: 4 }),
        ],
      }),
    );
    volcanoClient.createVideoTask.mockImplementation(async () => ({
      id: `volcano-task-${volcanoClient.createVideoTask.mock.calls.length}`,
    }));
    volcanoClient.getVideoTask.mockImplementation(async (...args: unknown[]) => {
      const providerTaskId = args[0] as string;
      if (providerTaskId === 'volcano-task-2') {
        return {
          id: providerTaskId,
          status: 'failed',
          error: { code: 'BAD_PROMPT', message: 'bad prompt' },
        };
      }
      return {
        id: providerTaskId,
        status: 'succeeded',
        content: {
          video_url: `https://example.com/${providerTaskId}.mp4`,
          last_frame_url: `https://example.com/${providerTaskId}.png`,
        },
        duration: 4,
        resolution: '1080p',
        ratio: '9:16',
      };
    });

    await expect(processor.process(job as never)).rejects.toThrow('bad prompt');

    expect(task.result?.segments).toEqual([
      expect.objectContaining({ index: 0, status: 'succeeded', video_url: 'https://example.com/volcano-task-1.mp4' }),
      expect.objectContaining({ index: 1, status: 'failed', error: expect.objectContaining({ code: 'BAD_PROMPT' }) }),
      expect.objectContaining({ index: 2, status: 'succeeded', video_url: 'https://example.com/volcano-task-3.mp4' }),
    ]);
    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'BAD_PROMPT', segment_index: 2 }),
      }),
    );
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ code: 'BAD_PROMPT', segment_index: 2 }),
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
