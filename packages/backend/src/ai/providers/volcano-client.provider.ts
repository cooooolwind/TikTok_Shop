import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VolcanoClientProvider {
  private readonly logger = new Logger(VolcanoClientProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async chatCompletion(_messages: unknown[], _options?: Record<string, unknown>) {
    const endpoint = this.configService.get<string>('volcano.textEndpoint') ?? 'stub';
    this.logger.log(`Volcano chat completion - stub (${endpoint})`);
    return { content: 'stub response' };
  }

  async videoGeneration(_params: Record<string, unknown>) {
    this.logger.log('Volcano video generation - stub');
    return { task_id: 'stub' };
  }

  async textToSpeech(_params: Record<string, unknown>) {
    this.logger.log('Volcano TTS - stub');
    return { audio_url: 'stub' };
  }
}
