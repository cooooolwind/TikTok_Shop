import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
import { Material } from './entities/material.entity';
import { VideoSlice } from './entities/video-slice.entity';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly volcanoClient: VolcanoClientProvider,
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(VideoSlice)
    private readonly videoSlicesRepository: Repository<VideoSlice>,
  ) {}

  async embedMaterial(materialId: string): Promise<void> {
    const material = await this.materialsRepository.findOne({ where: { id: materialId } });
    if (!material) {
      this.logger.warn(`Material ${materialId} not found for embedding`);
      return;
    }

    const textParts = [material.aiDescription, ...(material.aiTags ?? [])].filter(Boolean);
    if (textParts.length === 0) {
      this.logger.log(`Material ${materialId} has no description/tags, skipping embedding`);
      return;
    }

    const embeddingText = textParts.join(' ');
    this.logger.log(`Generating embedding for material ${materialId}: "${embeddingText.substring(0, 50)}..."`);

    try {
      const embedding = await this.volcanoClient.generateEmbedding(
        [{ type: 'text', text: embeddingText }],
        { dimensions: 2048 },
      );

      material.aiEmbedding = embedding;
      await this.materialsRepository.save(material);
      this.logger.log(`Embedding stored for material ${materialId} (${embedding.length} dimensions)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate embedding for material ${materialId}: ${msg}`);
      throw error;
    }
  }

  async embedVideoSlices(materialId: string): Promise<void> {
    const slices = await this.videoSlicesRepository.find({ where: { materialId } });
    if (!slices.length) return;

    const slicesWithText = slices.filter((s) => s.description || (s.tags && s.tags.length > 0));
    if (!slicesWithText.length) {
      this.logger.log(`No slices with text for material ${materialId}, skipping slice embedding`);
      return;
    }

    this.logger.log(`Generating embeddings for ${slicesWithText.length} slices of material ${materialId}`);

    for (const slice of slicesWithText) {
      const textParts = [slice.description, ...(slice.tags ?? [])].filter(Boolean);
      const embeddingText = textParts.join(' ');

      try {
        const embedding = await this.volcanoClient.generateEmbedding(
          [{ type: 'text', text: embeddingText }],
          { dimensions: 2048 },
        );
        slice.embedding = embedding;
        await this.videoSlicesRepository.save(slice);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to embed slice ${slice.id}: ${msg}`);
      }
    }
  }

  async textToVector(query: string): Promise<number[]> {
    return this.volcanoClient.generateEmbedding(
      [{ type: 'text', text: query }],
      { dimensions: 2048 },
    );
  }
}