import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
import { Material } from '../../modules/materials/entities/material.entity';
import { VideoSlice } from '../../modules/materials/entities/video-slice.entity';
import { TasksGateway } from '../../websocket/tasks.gateway';
import { VideoUtil } from '../../common/utils/video.util';
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

@Processor(QUEUES.MATERIAL_ANALYSIS)
export class MaterialAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(MaterialAnalysisProcessor.name);

  constructor(
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(VideoSlice)
    private readonly videoSlicesRepository: Repository<VideoSlice>,
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly tasksGateway: TasksGateway,
    private readonly configService: ConfigService,
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
        // 1. Upload video via Files API (Robust for large files)
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
        const input = [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: `You are an expert in TikTok Shop video analysis and scene segmentation.
Analyze the video and return a JSON object with:
1. "tags": 5-8 general tags for the entire video.
2. "description": A concise summary of the video content.
3. "slices": An array of scene objects, each containing:
   - "start_time": Start time in seconds (float).
   - "end_time": End time in seconds (float).
   - "description": What happens in this scene.
   - "tags": 3-5 tags specific to this scene.
Segment the video into natural, high-value scenes for e-commerce reuse. Output must be in JSON format.`,
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Please analyze and segment this video.' },
              { type: 'input_video', file_id: fileId },
            ],
          },
        ];

        const aiResponse = await this.volcanoClient.createResponse(input, {
          text: { format: { type: 'json_object' } },
        });
        result = this.parseAiResponse(aiResponse.content);
      } else {
        // 3. Use Base64 for images (Fast and no double-hop)
        const buffer = await fs.readFile(filePath);
        const base64Data = `data:${material.mimeType};base64,${buffer.toString('base64')}`;
        const messages = this.buildImageMessages(base64Data);

        const aiResponse = await this.volcanoClient.chatCompletion(messages, {
          response_format: { type: 'json_object' },
        });
        result = this.parseAiResponse(aiResponse.content);
      }

      // 4. Update Material
      material.aiTags = result.tags;
      material.aiDescription = result.description;
      material.status = 'ready';
      await this.materialsRepository.save(material);

      // 6. Handle Video Slices (Option C: Semantic Slicing)
      if (isVideo && result.slices?.length) {
        this.logger.log(`Detected ${result.slices.length} semantic slices for material: ${materialId}`);
        await this.handleSlices(material, result.slices, filePath);
      }

      // 7. Notify via WebSocket
      this.tasksGateway.emitMaterialAnalyzed(material.id, material.aiTags, material.aiDescription);

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

  private buildImageMessages(base64Data: string) {
    return [
      {
        role: 'system',
        content: `You are an expert in TikTok Shop content analysis. 
Analyze the image and return a JSON object with:
1. "tags": 5-8 general descriptive tags.
2. "description": A concise, one-sentence summary.
Output must be in JSON format.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please analyze this e-commerce material.' },
          { type: 'image_url', image_url: { url: base64Data } },
        ],
      },
    ];
  }

  private async handleSlices(material: Material, aiSlices: AiSliceResult[], videoPath: string) {
    // Clear existing slices if any
    await this.videoSlicesRepository.delete({ materialId: material.id });

    const storage = this.configService.get('storage') as { localPath: string };
    const thumbnailsDir = join(storage.localPath, 'materials', 'thumbnails');
    await fs.mkdir(thumbnailsDir, { recursive: true });

    const slices: VideoSlice[] = [];
    for (const aiSlice of aiSlices) {
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

      slices.push(slice);
    }

    await this.videoSlicesRepository.save(slices);
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
        description: 'Failed to parse detailed AI analysis.',
      };
    }
  }

  private async markAsFailed(id: string, errorMessage: string) {
    try {
      await this.materialsRepository.update(id, {
        status: 'failed',
        aiDescription: `Analysis failed: ${errorMessage}`,
      });
    } catch (e) {
      const markFailedError = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to mark material ${id} as failed: ${markFailedError}`);
    }
  }
}
