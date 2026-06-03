import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MaterialAnalysisProcessor } from './material-analysis.processor';
import { Material } from '../../modules/materials/entities/material.entity';
import { VideoSlice } from '../../modules/materials/entities/video-slice.entity';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
import { TasksGateway } from '../../websocket/tasks.gateway';
import { Job } from 'bullmq';
import { promises as fs } from 'fs';

jest.mock('../../common/utils/video.util');

describe('MaterialAnalysisProcessor', () => {
  let processor: MaterialAnalysisProcessor;
  let materialsRepository: any;
  let videoSlicesRepository: any;
  let volcanoClient: any;
  let tasksGateway: any;
  let configService: any;

  beforeEach(async () => {
    materialsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    videoSlicesRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      delete: jest.fn().mockResolvedValue({}),
    };

    volcanoClient = {
      chatCompletion: jest.fn(),
      uploadFile: jest.fn().mockResolvedValue('file-id-123'),
      getFile: jest.fn().mockResolvedValue({ status: 'active' }),
      createResponse: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue({}),
    };

    tasksGateway = {
      emitMaterialAnalyzed: jest.fn(),
      emitMaterialAnalysisFailed: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'storage') return { localPath: '/tmp/uploads' };
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialAnalysisProcessor,
        {
          provide: getRepositoryToken(Material),
          useValue: materialsRepository,
        },
        {
          provide: getRepositoryToken(VideoSlice),
          useValue: videoSlicesRepository,
        },
        {
          provide: VolcanoClientProvider,
          useValue: volcanoClient,
        },
        {
          provide: TasksGateway,
          useValue: tasksGateway,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    processor = module.get<MaterialAnalysisProcessor>(MaterialAnalysisProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should analyze image material and update its tags and description', async () => {
    const materialId = 'test-id';
    const material = {
      id: materialId,
      url: '/uploads/materials/test.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      aiTags: [],
      aiDescription: '',
      status: 'processing',
    };

    materialsRepository.findOne.mockResolvedValue(material);
    jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('fake-image-data'));
    
    volcanoClient.chatCompletion.mockResolvedValue({
      content: JSON.stringify({
        tags: ['tag1', 'tag2'],
        description: 'A test description',
      }),
    });

    const job = {
      data: { materialId },
    } as Job;

    const result = await processor.process(job);

    expect(result.tags).toEqual(['tag1', 'tag2']);
    expect(volcanoClient.uploadFile).not.toHaveBeenCalled(); // Images use Base64
    expect(materialsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        aiTags: ['tag1', 'tag2'],
        aiDescription: 'A test description',
        status: 'ready',
      }),
    );
  });

  it('should analyze video material using Files API and perform semantic slicing', async () => {
    const materialId = 'test-video-id';
    const material = {
      id: materialId,
      url: '/uploads/materials/test.mp4',
      type: 'video',
      mimeType: 'video/mp4',
      aiTags: [],
      aiDescription: '',
      status: 'processing',
    };

    materialsRepository.findOne.mockResolvedValue(material);
    jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('fake-video-data'));
    
    volcanoClient.createResponse.mockResolvedValue({
      content: JSON.stringify({
        tags: ['v-tag1'],
        description: 'V desc',
        slices: [
          { start_time: 0, end_time: 5, description: 'Scene 1', tags: ['s1'] },
          { start_time: 5, end_time: 10, description: 'Scene 2', tags: ['s2'] },
        ],
      }),
    });

    const job = {
      data: { materialId },
    } as Job;

    const result = await processor.process(job);

    expect(result.tags).toEqual(['v-tag1']);
    expect(volcanoClient.uploadFile).toHaveBeenCalled();
    expect(volcanoClient.createResponse).toHaveBeenCalled();
    expect(videoSlicesRepository.save).toHaveBeenCalled();
    expect(materialsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    );
  });

  it('should handle malformed AI response gracefully', async () => {
    const materialId = 'test-id';
    const material = {
      id: materialId,
      url: '/uploads/materials/test.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
    };

    materialsRepository.findOne.mockResolvedValue(material);
    jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('fake-image-data'));
    
    volcanoClient.chatCompletion.mockResolvedValue({
      content: 'not a json',
    });

    const job = {
      data: { materialId },
    } as Job;

    const result = await processor.process(job);

    expect(result.tags).toEqual(['auto-tagged']);
    expect(materialsRepository.save).toHaveBeenCalled();
  });

  it('should preserve previous aiTags and aiDescription on analysis failure', async () => {
    const materialId = 'test-id';
    const material = {
      id: materialId,
      url: '/uploads/materials/test.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      aiTags: ['existing-tag'],
      aiDescription: 'existing description',
      status: 'processing',
    };

    materialsRepository.findOne.mockResolvedValue(material);
    jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('fake-image-data'));
    
    volcanoClient.chatCompletion.mockRejectedValue(new Error('AI service error'));

    const job = {
      data: { materialId },
    } as Job;

    await expect(processor.process(job)).rejects.toThrow('AI service error');

    expect(materialsRepository.update).toHaveBeenCalledWith(
      materialId,
      { status: 'failed' },
    );
    expect(tasksGateway.emitMaterialAnalysisFailed).toHaveBeenCalledWith(
      materialId,
      'AI service error',
    );
    // Verify aiTags and aiDescription are NOT overwritten
    expect(materialsRepository.update).not.toHaveBeenCalledWith(
      materialId,
      expect.objectContaining({ aiDescription: expect.any(String) }),
    );
  });
});
