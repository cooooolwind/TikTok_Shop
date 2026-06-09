import { BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import { ScriptsService } from './scripts.service';
import { Script } from './entities/script.entity';
import { Scene } from './entities/scene.entity';

const now = new Date('2026-05-23T00:00:00.000Z');

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    merchantId: 'default',
    productInfo: {
      name: 'Summer Dress',
      description: 'Lightweight dress',
      category: 'fashion',
      selling_points: ['breathable'],
    },
    templateId: null as never,
    referenceId: null as never,
    sourceMaterialIds: [],
    generationTaskId: null as never,
    generationError: null as never,
    mode: 'free',
    narrativeFramework: '',
    visualStyle: '',
    totalDuration: 15,
    status: 'draft',
    scenes: [],
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
    description: 'Show the product',
    cameraMotion: 'fixed',
    duration: 3,
    dialogue: 'Meet your new summer essential',
    bgmStyle: 'upbeat',
    subtitle: 'Summer essential',
    visualPrompt: 'Product close-up',
    constraints: [],
    createdAt: now,
    updatedAt: now,
    script: undefined as never,
    ...overrides,
  };
}

function makeService(options?: { script?: Script | null; scripts?: Script[] }) {
  const script = options && 'script' in options ? options.script : makeScript();
  const scripts = options?.scripts ?? ([script].filter(Boolean) as Script[]);
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([scripts, scripts.length]),
  };
  const scriptsRepository = {
    create: jest.fn((data) => makeScript(data)),
    save: jest.fn(async (data) => ({ ...makeScript(), ...data })),
    findOne: jest.fn(async () => script),
    remove: jest.fn(async (data) => data),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const scenesRepository = {
    create: jest.fn((data) => makeScene(data)),
    save: jest.fn(async (data) => ({ ...makeScene(), ...data })),
    delete: jest.fn(async () => ({ affected: 1 })),
    findOne: jest.fn(async () => makeScene()),
    find: jest.fn(async () => [makeScene()]),
    remove: jest.fn(async (data) => data),
  };
  const materialsRepository = {
    findBy: jest.fn(async () => []),
    find: jest.fn(async () => []),
  };
  const generationTasksRepository = {
    delete: jest.fn(async () => ({ affected: 0 })),
  };
  const videosRepository = {
    delete: jest.fn(async () => ({ affected: 0 })),
  };
  const templatesService = {
    findRawById: jest.fn(async () => null),
  };
  const referencesService = {
    findOne: jest.fn(async () => null),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'storage') return { localPath: 'uploads-test' };
      return undefined;
    }),
  };
  const scriptQueue = {
    add: jest.fn(async () => ({ id: 'job-1' })),
  };

  const service = new ScriptsService(
    scriptsRepository as never,
    scenesRepository as never,
    materialsRepository as never,
    generationTasksRepository as never,
    videosRepository as never,
    templatesService as never,
    referencesService as never,
    configService as never,
    scriptQueue as never,
  );

  return {
    service,
    scriptsRepository,
    scenesRepository,
    materialsRepository,
    generationTasksRepository,
    videosRepository,
    templatesService,
    referencesService,
    scriptQueue,
    queryBuilder,
  };
}

describe('ScriptsService', () => {
  it('creates a generating script and queues AI generation', async () => {
    const { service, scriptsRepository, scriptQueue } = makeService();

    const result = await service.generate({
      product_info: {
        name: 'Summer Dress',
        description: 'Lightweight dress',
        category: 'fashion',
        selling_points: ['breathable'],
      },
      mode: 'free',
      preferences: { duration: 15, language: 'zh' },
    });

    expect(scriptsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'generating' }));
    expect(scriptQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ scriptId: 'script-1' }),
      expect.objectContaining({ attempts: 2 }),
    );
    expect(result).toMatchObject({ task_id: 'script_generation_script-1', status: 'queued' });
  });

  it('loads selected materials for material-driven generation', async () => {
    const { service, materialsRepository, scriptQueue } = makeService();
    materialsRepository.find.mockResolvedValue([
      { id: 'material-1', filename: 'dress.jpg', tags: ['dress'], aiTags: [], aiDescription: '', category: 'product', status: 'uploaded' },
    ] as never);

    await service.generate({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      material_ids: ['material-1'],
    });

    expect(materialsRepository.find).toHaveBeenCalled();
    expect(scriptQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ materialContext: expect.stringContaining('dress.jpg') }),
      expect.anything(),
    );
  });

  it('includes material AI analysis and video slices in script generation context', async () => {
    const { service, materialsRepository, scriptQueue } = makeService();
    materialsRepository.find.mockResolvedValue([
      {
        id: 'material-1',
        filename: 'try-on.mp4',
        type: 'video',
        url: '/uploads/materials/try-on.mp4',
        thumbnailUrl: '/uploads/materials/try-on.jpg',
        tags: ['summer'],
        aiTags: ['breathable', 'model try-on'],
        aiDescription: 'Model shows breathable summer dress fabric and fit.',
        category: 'scene',
        status: 'ready',
        slices: [
          {
            startTime: 0,
            endTime: 2.5,
            description: 'Opening try-on shot with full outfit.',
            tags: ['opening', 'try-on'],
          },
          {
            startTime: 2.5,
            endTime: 5,
            description: 'Close-up of fabric texture.',
            tags: ['fabric'],
          },
        ],
      },
    ] as never);

    await service.generate({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      material_ids: ['material-1'],
    });

    expect(materialsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { slices: true } }),
    );
    expect(scriptQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({
        materialContext: expect.stringContaining('ai_description=Model shows breathable summer dress fabric and fit.'),
      }),
      expect.anything(),
    );
    const queuedJob = (scriptQueue.add as jest.Mock).mock.calls[0]?.[1] as {
      materialContext: string;
    };
    const queuedContext = queuedJob.materialContext;
    expect(queuedContext).toContain('slice 1: 0-2.5s');
    expect(queuedContext).toContain('Opening try-on shot with full outfit.');
    expect(queuedContext).toContain('tags=opening,try-on');
  });

  it('copies selected image material urls into generated script product images', async () => {
    const { service, scriptsRepository, materialsRepository } = makeService();
    materialsRepository.find.mockResolvedValue([
      {
        id: 'material-1',
        type: 'image',
        url: '/uploads/materials/dress.jpg',
        filename: 'dress.jpg',
        tags: [],
        aiTags: [],
        aiDescription: '',
        category: 'product',
        status: 'uploaded',
      },
      {
        id: 'material-2',
        type: 'video',
        url: '/uploads/materials/demo.mp4',
        filename: 'demo.mp4',
        tags: [],
        aiTags: [],
        aiDescription: '',
        category: 'scene',
        status: 'uploaded',
      },
    ] as never);

    await service.generate({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      material_ids: ['material-1', 'material-2'],
    });

    expect(scriptsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productInfo: expect.objectContaining({ images: ['/uploads/materials/dress.jpg'] }),
      }),
    );
  });

  it('copies selected image material urls into manual draft product images', async () => {
    const { service, scriptsRepository, materialsRepository } = makeService();
    materialsRepository.find.mockResolvedValue([
      {
        id: 'material-1',
        type: 'image',
        url: '/uploads/materials/dress.jpg',
        filename: 'dress.jpg',
        tags: [],
        aiTags: [],
        aiDescription: '',
        category: 'product',
        status: 'uploaded',
      },
    ] as never);

    await service.create({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      source_material_ids: ['material-1'],
      scenes: [],
    });

    expect(scriptsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productInfo: expect.objectContaining({ images: ['/uploads/materials/dress.jpg'] }),
      }),
    );
  });

  it('embeds local image materials as multimodal data URLs', async () => {
    const { service, materialsRepository, scriptQueue } = makeService();
    jest.spyOn(fsPromises, 'readFile').mockResolvedValue(Buffer.from('image-bytes'));
    materialsRepository.find.mockResolvedValue([
      {
        id: 'material-1',
        type: 'image',
        url: '/uploads/materials/dress.jpg',
        filename: 'dress.jpg',
        tags: ['dress'],
        aiTags: [],
        aiDescription: '',
        category: 'product',
        status: 'uploaded',
        mimeType: 'image/jpeg',
      },
    ] as never);

    await service.generate({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      material_ids: ['material-1'],
    });

    expect(scriptQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({
        materialMedia: [
          expect.objectContaining({
            type: 'image',
            imageUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('creates a manual structured draft without queueing AI', async () => {
    const { service, scriptsRepository, scenesRepository, scriptQueue } = makeService();

    const result = await service.create({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      scenes: [
        {
          description: 'Opening',
          camera_motion: 'fixed',
          duration: 3,
          dialogue: 'Hello',
          bgm_style: 'upbeat',
          subtitle: 'Hello',
          visual_prompt: 'Opening shot',
          constraints: [],
        },
      ],
    });

    expect(scriptsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    expect(scenesRepository.save).toHaveBeenCalled();
    expect(scriptQueue.add).not.toHaveBeenCalled();
    expect(result.status).toBe('draft');
  });

  it('queues manual text import for AI parsing', async () => {
    const { service, scriptQueue } = makeService();

    await service.generate({
      product_info: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
      mode: 'free',
      manual_text: 'Scene 1: show the dress.',
    });

    expect(scriptQueue.add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ manualText: 'Scene 1: show the dress.' }),
      expect.anything(),
    );
  });

  it('retries failed scripts only', async () => {
    const { service, scriptQueue } = makeService({ script: makeScript({ status: 'failed' }) });

    const result = await service.retry('script-1');

    expect(scriptQueue.add).toHaveBeenCalled();
    expect(result).toEqual({ task_id: 'script_generation_script-1', status: 'queued' });
  });

  it('rejects retry for non-failed scripts', async () => {
    const { service } = makeService({ script: makeScript({ status: 'draft' }) });

    await expect(service.retry('script-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when script detail is missing', async () => {
    const { service } = makeService({ script: null });

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes related videos and generation tasks before deleting a script', async () => {
    const { service, generationTasksRepository, videosRepository, scriptsRepository } = makeService();

    await service.remove('script-1');

    expect(videosRepository.delete).toHaveBeenCalledWith({ scriptId: 'script-1' });
    expect(generationTasksRepository.delete).toHaveBeenCalledWith({ scriptId: 'script-1' });
    expect(scriptsRepository.remove).toHaveBeenCalled();
  });
});
