import { EmbeddingService } from './embedding.service';
import { Material } from './entities/material.entity';
import { VideoSlice } from './entities/video-slice.entity';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let volcanoClient: any;
  let materialsRepo: any;
  let videoSlicesRepo: any;

  beforeEach(() => {
    volcanoClient = {
      generateEmbedding: jest.fn(),
    };
    materialsRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (m: any) => m),
      createQueryBuilder: jest.fn(),
    };
    videoSlicesRepo = {
      find: jest.fn(),
      save: jest.fn(async (s: any) => s),
    };

    service = new EmbeddingService(volcanoClient as any, materialsRepo, videoSlicesRepo);
  });

  describe('embedMaterial', () => {
    it('generates text embedding from description and tags for images', async () => {
      const material = {
        id: 'mat-1',
        type: 'image',
        url: '/uploads/materials/test.jpg',
        mimeType: 'image/jpeg',
        aiDescription: 'A beautiful product photo',
        aiTags: ['product', 'beauty'],
        aiEmbedding: null,
      } as unknown as Material;

      const mockEmbedding = Array.from({ length: 2048 }, (_, i) => i * 0.001);
      volcanoClient.generateEmbedding.mockResolvedValue(mockEmbedding);
      materialsRepo.findOne.mockResolvedValue(material);
      materialsRepo.save.mockImplementation(async (m: any) => m);

      await service.embedMaterial('mat-1');

      expect(volcanoClient.generateEmbedding).toHaveBeenCalledWith(
        [{ type: 'text', text: 'A beautiful product photo product beauty' }],
        { dimensions: 2048 },
      );
      expect(materialsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ aiEmbedding: mockEmbedding }),
      );
    });

    it('generates text embedding for video material', async () => {
      const material = {
        id: 'mat-2',
        type: 'video',
        url: '/uploads/materials/test.mp4',
        mimeType: 'video/mp4',
        aiDescription: 'Product demo video',
        aiTags: ['demo', 'product'],
        aiEmbedding: null,
      } as unknown as Material;

      const mockEmbedding = Array.from({ length: 2048 }, (_, i) => i * 0.001);
      volcanoClient.generateEmbedding.mockResolvedValue(mockEmbedding);
      materialsRepo.findOne.mockResolvedValue(material);
      materialsRepo.save.mockImplementation(async (m: any) => m);

      await service.embedMaterial('mat-2');

      expect(volcanoClient.generateEmbedding).toHaveBeenCalledWith(
        [{ type: 'text', text: 'Product demo video demo product' }],
        { dimensions: 2048 },
      );
    });

    it('skips embedding when material has no description or tags', async () => {
      const material = {
        id: 'mat-3',
        type: 'image',
        aiDescription: null,
        aiTags: [],
        aiEmbedding: null,
      } as unknown as Material;

      materialsRepo.findOne.mockResolvedValue(material);

      await service.embedMaterial('mat-3');

      expect(volcanoClient.generateEmbedding).not.toHaveBeenCalled();
    });

    it('handles embedding API failure by throwing', async () => {
      const material = {
        id: 'mat-4',
        type: 'image',
        aiDescription: 'test desc',
        aiTags: ['tag1'],
        aiEmbedding: null,
      } as unknown as Material;

      volcanoClient.generateEmbedding.mockRejectedValue(new Error('API timeout'));
      materialsRepo.findOne.mockResolvedValue(material);

      await expect(service.embedMaterial('mat-4')).rejects.toThrow('API timeout');
    });

    it('warns and returns when material not found', async () => {
      materialsRepo.findOne.mockResolvedValue(null);

      await service.embedMaterial('nonexistent');

      expect(volcanoClient.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('embedVideoSlices', () => {
    it('generates embeddings for all slices of a video', async () => {
      const slices = [
        { id: 's1', materialId: 'mat-2', description: 'Scene one', tags: ['intro'], embedding: null },
        { id: 's2', materialId: 'mat-2', description: 'Scene two', tags: ['climax'], embedding: null },
      ] as unknown as VideoSlice[];

      videoSlicesRepo.find.mockResolvedValue(slices);
      volcanoClient.generateEmbedding
        .mockResolvedValueOnce(Array.from({ length: 2048 }, (_, i) => i * 0.001))
        .mockResolvedValueOnce(Array.from({ length: 2048 }, (_, i) => i * 0.002));
      videoSlicesRepo.save.mockImplementation(async (s: any) => s);

      await service.embedVideoSlices('mat-2');

      expect(volcanoClient.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(volcanoClient.generateEmbedding).toHaveBeenCalledWith(
        [{ type: 'text', text: 'Scene one intro' }],
        { dimensions: 2048 },
      );
      expect(volcanoClient.generateEmbedding).toHaveBeenCalledWith(
        [{ type: 'text', text: 'Scene two climax' }],
        { dimensions: 2048 },
      );
    });

    it('skips slices without description', async () => {
      const slices = [
        { id: 's1', description: null, tags: [], embedding: null },
      ] as unknown as VideoSlice[];

      videoSlicesRepo.find.mockResolvedValue(slices);

      await service.embedVideoSlices('mat-2');

      expect(volcanoClient.generateEmbedding).not.toHaveBeenCalled();
    });

    it('returns early when no slices found', async () => {
      videoSlicesRepo.find.mockResolvedValue([]);

      await service.embedVideoSlices('mat-2');

      expect(volcanoClient.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('textToVector', () => {
    it('converts query text to embedding vector', async () => {
      const mockVec = Array.from({ length: 2048 }, (_, i) => i * 0.005);
      volcanoClient.generateEmbedding.mockResolvedValue(mockVec);

      const result = await service.textToVector('summer beach product');

      expect(volcanoClient.generateEmbedding).toHaveBeenCalledWith(
        [{ type: 'text', text: 'summer beach product' }],
        { dimensions: 2048 },
      );
      expect(result).toEqual(mockVec);
    });
  });
});