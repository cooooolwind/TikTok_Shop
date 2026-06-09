import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
import { buildImageAnalysisMessages, buildVideoAnalysisInput, buildReferenceVideoAnalysisInput } from '../../ai/prompts';
import { Material } from '../../modules/materials/entities/material.entity';
import { VideoSlice } from '../../modules/materials/entities/video-slice.entity';
import { MaterialAnalysis } from '../../modules/materials/entities/material-analysis.entity';
import { TasksGateway } from '../../websocket/tasks.gateway';
import { VideoUtil } from '../../common/utils/video.util';
import { EmbeddingService } from '../../modules/materials/embedding.service';
import { QUEUES } from '../queues';

interface MaterialAnalysisJob {
  materialId: string;
}

interface AiSliceResult {
  start_time: number;
  end_time: number;
  description: string;
  tags: string[];
}

interface AiAnalysisResult {
  tags: string[];
  description: string;
  slices?: AiSliceResult[];
}

interface ReferenceAnalysisResult {
  hook: string;
  selling_points: string[];
  style: string;
  duration: number;
  storyboard: any[];
}

@Processor(QUEUES.MATERIAL_ANALYSIS)
export class MaterialAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(MaterialAnalysisProcessor.name);

  constructor(
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(VideoSlice)
    private readonly videoSlicesRepository: Repository<VideoSlice>,
    @InjectRepository(MaterialAnalysis)
    private readonly analysisRepository: Repository<MaterialAnalysis>,
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly tasksGateway: TasksGateway,
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
  ) {
    super();
  }

  async process(job: Job<MaterialAnalysisJob>): Promise<AiAnalysisResult> {
    const { materialId } = job.data;
    this.logger.log(`Starting multimodal analysis for material: ${materialId}`);

    let fileId: string | null = null;
    let result: AiAnalysisResult;
    try {
      const material = await this.materialsRepository.findOne({ where: { id: materialId } });
      if (!material) {
        throw new Error(`Material ${materialId} not found`);
      }

      const storage = this.configService.get('storage') as { localPath: string };
      const filename = basename(material.url);
      const filePath = join(storage.localPath, 'materials', filename);
      const isVideo = material.type === 'video';

      if (isVideo) {
        // 0. Transcode and Compress for web compatibility (skip if already transcoded)
        const alreadyTranscoded = material.metadata?.transcoded === true || material.metadata?.compressed === true;
        if (alreadyTranscoded) {
          this.logger.log(`Skipping transcoding for ${materialId}: video was already transcoded`);
        } else {
          this.tasksGateway.emitMaterialAnalysisStep(materialId, 'transcoding');
          this.logger.log(`Transcoding video for compatibility: ${materialId}`);
          const transcodedPath = `${filePath}.transcoded.mp4`;
          try {
            const transcodeResult = await VideoUtil.transcode(filePath, transcodedPath, {
              bitrateThresholdKbps: 6000, // 6Mbps threshold
              targetCrf: 23,
            });

            // Replace original file with transcoded one
            await fs.unlink(filePath);
            await fs.rename(transcodedPath, filePath);

            // Update metadata (size and duration)
            const newMeta = await VideoUtil.getMetadata(filePath);
            material.size = newMeta.size;
            material.metadata = {
              ...material.metadata,
              duration: newMeta.duration,
              compressed: transcodeResult.compressed,
              transcoded: true,
            };
            await this.materialsRepository.save(material);
            this.logger.log(`Transcoding completed for ${materialId}. Compressed: ${transcodeResult.compressed}`);
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            this.logger.warn(`Transcoding failed for ${materialId}, falling back to original: ${error}`);
            if (await fs.stat(transcodedPath).catch(() => null)) {
              await fs.unlink(transcodedPath).catch(() => {});
            }
          }
        }

        // 1. Upload video via Files API (Robust for large files)
        this.tasksGateway.emitMaterialAnalysisStep(materialId, 'uploading');
        this.logger.log(`Uploading video to Volcano for analysis: ${materialId}`);
        const buffer = await fs.readFile(filePath);
        fileId = await this.volcanoClient.uploadFile(buffer, filename);

        // Wait for file to be active (Volcano process file asynchronously)
        this.logger.log(`Waiting for video file to be active: ${fileId}`);
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds
        while (attempts < maxAttempts) {
          const file = await this.volcanoClient.getFile(fileId);
          if (file.status === 'active') break;
          if (file.status === 'failed') throw new Error('Volcano file preprocessing failed');
          
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts += 1;
        }
        if (attempts >= maxAttempts) {
          throw new Error('Volcano file preprocessing timeout');
        }
        
        // 2. Prepare input for Responses API (Supports file_id correctly)
        this.tasksGateway.emitMaterialAnalysisStep(materialId, 'analyzing');
        if (material.sourceDeclaration === 'reference') {
          const input = buildReferenceVideoAnalysisInput(fileId);
          const aiResponse = await this.volcanoClient.createResponse(input, {
            text: { format: { type: 'json_object' } },
          });
          this.logger.debug(`Responses API raw content length: ${aiResponse.content?.length ?? 0}`);
          const refResult = this.parseReferenceAiResponse(aiResponse.content);
          
          await this.analysisRepository.delete({ materialId: material.id });
          const analysisRecord = this.analysisRepository.create({
            materialId: material.id,
            hook: refResult.hook,
            style: refResult.style,
            duration: refResult.duration,
            sellingPoints: refResult.selling_points,
            storyboard: refResult.storyboard,
          });
          await this.analysisRepository.save(analysisRecord);
          
          result = { tags: ['reference'], description: refResult.hook || '参考视频', slices: [] };
        } else {
          const input = buildVideoAnalysisInput(fileId);

          const aiResponse = await this.volcanoClient.createResponse(input, {
            text: { format: { type: 'json_object' } },
          });
          this.logger.debug(`Responses API raw content length: ${aiResponse.content?.length ?? 0}`);
          result = this.parseAiResponse(aiResponse.content);
        }
      } else {
        // 3. Use Base64 for images (Fast and no double-hop)
        this.tasksGateway.emitMaterialAnalysisStep(materialId, 'analyzing');
        const buffer = await fs.readFile(filePath);
        const base64Data = `data:${material.mimeType};base64,${buffer.toString('base64')}`;
        const messages = buildImageAnalysisMessages(base64Data);

        const aiResponse = await this.volcanoClient.chatCompletion(messages, {
          response_format: { type: 'json_object' },
        });
        this.logger.debug(`Chat API raw content length: ${aiResponse.content?.length ?? 0}`);
        result = this.parseAiResponse(aiResponse.content);
      }

      // 4. Update Material
      material.aiTags = result.tags;
      material.aiDescription = result.description;
      const isFallback = result.tags.length === 1 && result.tags[0] === 'auto-tagged';
      material.status = isFallback ? 'failed' : 'ready';
      await this.materialsRepository.save(material);

      // 6. Handle Video Slices (Option C: Semantic Slicing)
      if (isVideo && result.slices?.length) {
        this.logger.log(`Detected ${result.slices.length} semantic slices for material: ${materialId}`);
        await this.handleSlices(material, result.slices, filePath);
      }

      // 7. Notify via WebSocket — AI tags are ready
      if (isFallback) {
        this.tasksGateway.emitMaterialAnalysisFailed(material.id, result.description);
      } else {
        this.tasksGateway.emitMaterialAnalyzed(material.id, material.aiTags, material.aiDescription);
      }

      // 8. Generate embeddings (semantic vectorization)
      if (!isFallback) {
        this.tasksGateway.emitMaterialAnalysisStep(materialId, 'embedding');
        try {
          await this.embeddingService.embedMaterial(material.id);
          if (isVideo) {
            await this.embeddingService.embedVideoSlices(material.id);
          }
          this.tasksGateway.emitMaterialEmbeddingComplete(materialId);
        } catch (embedError) {
          const embedMsg = embedError instanceof Error ? embedError.message : String(embedError);
          this.logger.warn(`Embedding generation failed for ${materialId}: ${embedMsg}. Material is still usable without vector search.`);
          this.tasksGateway.emitMaterialEmbeddingFailed(materialId, embedMsg);
        }
      } else {
        // Fallback materials should still complete the flow
        this.tasksGateway.emitMaterialEmbeddingComplete(materialId);
      }

      this.logger.log(`Completed analysis for material: ${materialId}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to analyze material ${materialId}: ${errorMessage}`);
      await this.markAsFailed(materialId, errorMessage);
      throw error;
    } finally {
      // 8. Cleanup remote file
      if (fileId) {
        await this.volcanoClient.deleteFile(fileId).catch(() => {});
      }
    }
  }

  private async handleSlices(material: Material, aiSlices: AiSliceResult[], videoPath: string) {
    // Clear existing slices if any
    await this.videoSlicesRepository.delete({ materialId: material.id });

    const storage = this.configService.get('storage') as { localPath: string };
    const thumbnailsDir = join(storage.localPath, 'materials', 'thumbnails');
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Parallelize thumbnail generation for slices
    const slices = await Promise.all(
      aiSlices.map(async (aiSlice) => {
        const sliceId = `${material.id}-${Math.round(aiSlice.start_time * 1000)}`;
        const thumbnailFilename = `${sliceId}.jpg`;
        const thumbnailPath = join(thumbnailsDir, thumbnailFilename);

        const slice = this.videoSlicesRepository.create({
          materialId: material.id,
          startTime: aiSlice.start_time,
          endTime: aiSlice.end_time,
          description: aiSlice.description,
          tags: aiSlice.tags,
          thumbnailUrl: `/uploads/materials/thumbnails/${thumbnailFilename}`,
        });

        // Generate thumbnail for the slice (mid-point frame)
        try {
          const midTime = (aiSlice.start_time + aiSlice.end_time) / 2;
          const frameBuffer = await VideoUtil.extractFrameAt(videoPath, midTime);
          await fs.writeFile(thumbnailPath, frameBuffer);
        } catch (e) {
          const thumbError = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Failed to generate thumbnail for slice ${sliceId}: ${thumbError}`);
          // Fallback to material thumbnail if extraction fails
          slice.thumbnailUrl = material.thumbnailUrl;
        }

        return slice;
      }),
    );

    await this.videoSlicesRepository.save(slices);
    this.logger.log(`Saved ${slices.length} slices for material ${material.id}`);
  }

  private parseAiResponse(content: string): AiAnalysisResult {
    try {
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        description: typeof parsed.description === 'string' ? parsed.description : 'No description provided.',
        slices: Array.isArray(parsed.slices) ? parsed.slices : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${content}`);
      return {
        tags: ['auto-tagged'],
        description: '未能解析详细的 AI 分析结果。',
      };
    }
  }

  private parseReferenceAiResponse(content: string): ReferenceAnalysisResult {
    try {
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return {
        hook: typeof parsed.hook === 'string' ? parsed.hook : '',
        selling_points: Array.isArray(parsed.selling_points) ? parsed.selling_points : [],
        style: typeof parsed.style === 'string' ? parsed.style : '',
        duration: typeof parsed.duration === 'number' ? parsed.duration : 0,
        storyboard: Array.isArray(parsed.storyboard) ? parsed.storyboard : [],
      };
    } catch (error) {
      this.logger.error(`Failed to parse Reference AI response: ${content}`);
      return {
        hook: '未能解析参考视频结构',
        selling_points: [],
        style: '未知',
        duration: 0,
        storyboard: [],
      };
    }
  }

  private async markAsFailed(id: string, errorMessage: string) {
    try {
      await this.materialsRepository.update(id, {
        status: 'failed',
      });
      this.tasksGateway.emitMaterialAnalysisFailed(id, errorMessage);
    } catch (e) {
      const markFailedError = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to mark material ${id} as failed: ${markFailedError}`);
    }
  }
}
