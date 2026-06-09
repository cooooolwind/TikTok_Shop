import { BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import { MaterialsService } from './materials.service';
import { Material } from './entities/material.entity';
import { VideoUtil } from '../../common/utils/video.util';

const now = new Date('2026-05-23T00:00:00.000Z');

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'material-1',
    merchantId: 'default',
    type: 'image',
    url: '/uploads/materials/file.jpg',
    thumbnailUrl: '/uploads/materials/file.jpg',
    name: 'product.jpg',
    filename: 'product.jpg',
    size: 123,
    mimeType: 'image/jpeg',
    category: 'product',
    tags: ['shoe'],
    sourceDeclaration: 'owned',
    sourcePlatform: '',
    aiTags: [],
    aiDescription: '',
    aiEmbedding: [],
    status: 'uploaded',
    metadata: { format: 'jpg' },
    createdAt: now,
    updatedAt: now,
    slices: [],
    analysis: null as any,
    ...overrides,
  };
}

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'product.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 123,
    buffer: Buffer.from('image'),
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

function makeService(options?: {
  material?: Material | null;
  materials?: Material[];
  exists?: boolean;
}) {
  const material = options && 'material' in options ? options.material : makeMaterial();
  const materials = options?.materials ?? ([material].filter(Boolean) as Material[]);

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([materials, materials.length]),
    getMany: jest.fn().mockResolvedValue(materials),
  };

  const materialsRepository = {
    create: jest.fn((data) => makeMaterial(data)),
    save: jest.fn(async (data) => ({ ...makeMaterial(), ...data })),
    findOne: jest.fn(async () => material),
    remove: jest.fn(async (data) => data),
    exist: jest.fn(async () => options?.exists ?? Boolean(material)),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const videoSlicesRepository = {
    find: jest.fn(async () => []),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'storage') {
        return {
          localPath: 'uploads-test',
          maxImageSize: 20 * 1024 * 1024,
          maxVideoSize: 500 * 1024 * 1024,
        };
      }
      return undefined;
    }),
  };

  const tasksGateway = {
    emitMaterialAnalyzed: jest.fn(),
  };

  const analysisQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const embeddingService = {
    textToVector: jest.fn().mockResolvedValue(Array.from({ length: 2048 }, (_, i) => i * 0.001)),
    embedMaterial: jest.fn(),
    embedVideoSlices: jest.fn(),
  };

  const service = new MaterialsService(
    materialsRepository as never,
    videoSlicesRepository as never,
    analysisQueue as never,
    configService as never,
    embeddingService as never,
  );

  return { service, materialsRepository, videoSlicesRepository, queryBuilder, tasksGateway, analysisQueue, embeddingService };
}

describe('MaterialsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads an image and persists it', async () => {
    const { service, materialsRepository, analysisQueue } = makeService();
    const mkdirSpy = jest.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
    const writeSpy = jest.spyOn(fsPromises, 'writeFile').mockResolvedValue(undefined);

    const result = await service.upload(makeFile(), {
      category: 'product',
      source_declaration: 'owned',
      tags: ['shoe'],
    });

    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalled();
    expect(materialsRepository.save).toHaveBeenCalled();
    expect(analysisQueue.add).toHaveBeenCalledWith('analyze', expect.objectContaining({ materialId: 'material-1' }));
    expect(result).toMatchObject({
      filename: 'product.jpg',
      type: 'image',
    });
  });

  it('uploads a video and eagerly generates a thumbnail', async () => {
    const { service, materialsRepository } = makeService();
    jest.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fsPromises, 'writeFile').mockResolvedValue(undefined);
    const extractSpy = jest.spyOn(VideoUtil, 'extractFrameAt').mockResolvedValue(Buffer.from('frame'));

    const result = await service.upload(makeFile({ mimetype: 'video/mp4', originalname: 'video.mp4' }), {
      category: 'product',
      source_declaration: 'owned',
    });

    expect(extractSpy).toHaveBeenCalledWith(expect.any(String), 0);
    expect(materialsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'video',
        thumbnailUrl: expect.stringContaining('.jpg'),
      }),
    );
    expect(result.type).toBe('video');
  });

  it('normalizes mojibake upload filenames before persisting', async () => {
    const { service, materialsRepository } = makeService();
    jest.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fsPromises, 'writeFile').mockResolvedValue(undefined);
    const mojibakeName = Buffer.from('商品图.jpg', 'utf8').toString('latin1');

    const result = await service.upload(makeFile({ originalname: mojibakeName }), {
      category: 'product',
      source_declaration: 'owned',
      tags: ['shoe'],
    });

    expect(materialsRepository.create).toHaveBeenCalledWith(expect.objectContaining({ filename: '商品图.jpg' }));
    expect(result.filename).toBe('商品图.jpg');
  });

  it('rejects unsupported file types', async () => {
    const { service } = makeService();

    await expect(
      service.upload(makeFile({ mimetype: 'application/pdf' }), {
        category: 'product',
        source_declaration: 'owned',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects images over the configured size limit', async () => {
    const { service } = makeService();

    await expect(
      service.upload(makeFile({ size: 21 * 1024 * 1024 }), {
        category: 'product',
        source_declaration: 'owned',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns paginated material list', async () => {
    const { service, queryBuilder } = makeService();

    const result = await service.findAll({ page: 1, pageSize: 20, type: 'image', keyword: 'shoe' });

    expect(queryBuilder.andWhere).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'material-1',
      source_declaration: 'owned',
      thumbnail_url: '/uploads/materials/file.jpg',
    });
  });

  it('normalizes existing mojibake filenames in list responses', async () => {
    const mojibakeName = Buffer.from('中文素材.png', 'utf8').toString('latin1');
    const { service } = makeService({
      materials: [makeMaterial({ filename: mojibakeName })],
    });

    const result = await service.findAll({ page: 1, pageSize: 20 });

    expect(result.items[0].filename).toBe('中文素材.png');
  });

  it('throws NotFoundException when material detail is missing', async () => {
    const { service } = makeService({ material: null });

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes one material and ignores missing local files', async () => {
    const { service, materialsRepository } = makeService();
    jest.spyOn(fsPromises, 'unlink').mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    const result = await service.remove('material-1');

    expect(materialsRepository.remove).toHaveBeenCalled();
    expect(result).toEqual({ message: 'deleted' });
  });

  it('removes materials in batch', async () => {
    const { service, materialsRepository } = makeService();
    jest.spyOn(fsPromises, 'unlink').mockResolvedValue(undefined);

    const result = await service.batchRemove(['material-1']);

    expect(materialsRepository.remove).toHaveBeenCalled();
    expect(result).toEqual({ message: 'deleted', deleted: 1 });
  });

  it('analyzes material by adding it to the analysis queue', async () => {
    const { service, materialsRepository, analysisQueue } = makeService();

    const result = await service.analyze('material-1');

    expect(materialsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' }),
    );
    expect(analysisQueue.add).toHaveBeenCalledWith('analyze', { materialId: 'material-1' });
    expect(result).toEqual({ task_id: 'job-1', status: 'queued' });
  });

  it('searches similar materials with text search', async () => {
    const { service } = makeService({
      materials: [makeMaterial({ filename: 'red shoe.jpg', aiDescription: 'comfortable shoe' })],
    });

    const result = await service.searchSimilar({ query: 'shoe', limit: 10, threshold: 0.1, mode: 'text' });

    expect(result).toHaveLength(1);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it('falls back to text search when semantic search fails', async () => {
    const { service, embeddingService } = makeService({
      materials: [makeMaterial({ filename: 'red shoe.jpg', aiDescription: 'comfortable shoe' })],
    });
    embeddingService.textToVector.mockRejectedValue(new Error('API error'));

    const result = await service.searchSimilar({ query: 'shoe', limit: 10, mode: 'semantic' });

    expect(result).toHaveLength(1);
    expect(result[0].score).toBeGreaterThan(0);
  });
});
