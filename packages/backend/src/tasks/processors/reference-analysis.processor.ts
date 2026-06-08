import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
import { ReferenceVideo } from '../../modules/references/entities/reference-video.entity';

interface ReferenceAnalysisJob {
  referenceId: string;
}

@Processor('reference-analysis')
export class ReferenceAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(ReferenceAnalysisProcessor.name);

  constructor(
    @InjectRepository(ReferenceVideo)
    private readonly referenceRepository: Repository<ReferenceVideo>,
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ReferenceAnalysisJob>): Promise<any> {
    const { referenceId } = job.data;
    this.logger.log(`Starting multimodal analysis for reference video: ${referenceId}`);

    let fileId: string | null = null;
    let ref = await this.referenceRepository.findOne({ where: { id: referenceId } });

    if (!ref) {
      throw new Error(`Reference video ${referenceId} not found`);
    }

    try {
      let filePath = '';
      let filename = '';

      // 1. 获取视频阶段 (Fetching)
      if (ref.sourcePlatform === 'local_upload') {
        const storage = this.configService.get('storage') as { localPath: string };
        filename = basename(ref.sourceUrl);
        // sourceUrl: /uploads/references/...
        filePath = join(storage.localPath, 'references', filename);
      } else {
        // 对于第三方平台链接抓取，暂时不实现，仅做异常或 Mock 处理
        this.logger.warn(`Fetching from third-party platform is not implemented yet. URL: ${ref.sourceUrl}`);
        throw new Error('Third-party URL fetching is not implemented.');
      }

      // 检查文件是否存在
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Local file not found: ${filePath}`);
      }

      // 2. 上传至火山方舟 File API 阶段 (Uploading)
      ref.analysisStatus = 'uploading';
      await this.referenceRepository.save(ref);

      this.logger.log(`Uploading reference video to Volcano for analysis: ${referenceId}`);
      const buffer = await fs.readFile(filePath);
      fileId = await this.volcanoClient.uploadFile(buffer, filename);

      // 等待火山方舟文件处理完成
      this.logger.log(`Waiting for reference video file to be active: ${fileId}`);
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

      // 3. 多模态结构化拆解阶段 (Analyzing)
      ref.analysisStatus = 'analyzing';
      await this.referenceRepository.save(ref);
      
      this.logger.log(`Analyzing reference video via Responses API: ${referenceId}`);
      const input = [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: `你是一个专业的短视频拆解专家。请仔细观看该视频，并严格按照以下 JSON 格式输出拆解报告：
{
  "hook": "前3秒使用的黄金三秒抓手手法描述",
  "selling_points": ["提取出的核心卖点1", "卖点2"],
  "style": "整体视觉与叙事风格描述",
  "duration": 15,
  "storyboard": [
    {
      "order": 1,
      "duration": 3,
      "description": "该分镜的画面描述",
      "camera_motion": "运镜手法",
      "visual_elements": ["视觉元素1"]
    }
  ]
}
输出必须为纯 JSON 格式。`,
            },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: '请拆解并结构化分析这段视频。' },
            { type: 'input_video', file_id: fileId },
          ],
        },
      ];

      const aiResponse = await this.volcanoClient.createResponse(input, {
        text: { format: { type: 'json_object' } },
      });
      
      this.logger.debug(`Responses API raw content length: ${aiResponse.content?.length ?? 0}`);
      
      const analysis = this.parseAiResponse(aiResponse.content);

      // 4. 完成阶段 (Done)
      ref.analysisStatus = 'done';
      ref.analysis = analysis as any;
      await this.referenceRepository.save(ref);
      
      this.logger.log(`Completed analysis for reference video: ${referenceId}`);
      return analysis;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to analyze reference video ${referenceId}: ${errorMessage}`);
      ref.analysisStatus = 'failed';
      await this.referenceRepository.save(ref);
      throw error;
    } finally {
      // 清理远程文件
      if (fileId) {
        await this.volcanoClient.deleteFile(fileId).catch(() => {});
      }
    }
  }

  private parseAiResponse(content: string): any {
    try {
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${content}`);
      // 返回一个兜底的结构
      return {
        hook: '无法解析',
        selling_points: [],
        style: '无法解析',
        duration: 0,
        storyboard: []
      };
    }
  }
}
