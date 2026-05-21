import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VolcanoClientProvider {
  private readonly logger = new Logger(VolcanoClientProvider.name);

  constructor(private readonly configService: ConfigService) {}

  /** 调用火山引擎文本/图片模型 (Doubao-Seed) */
  async chatCompletion(_messages: unknown[], _options?: Record<string, unknown>) {
    this.logger.log('Volcano chat completion - stub');
    return { content: 'stub response' };
  }

  /** 调用火山引擎视频模型 (Seedance) */
  async videoGeneration(_params: Record<string, unknown>) {
    this.logger.log('Volcano video generation - stub');
    return { task_id: 'stub' };
  }

  /** 调用火山引擎 TTS */
  async textToSpeech(_params: Record<string, unknown>) {
    this.logger.log('Volcano TTS - stub');
    return { audio_url: 'stub' };
  }
}
