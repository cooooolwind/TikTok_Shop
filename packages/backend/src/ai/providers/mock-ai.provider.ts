import { Injectable, Logger } from '@nestjs/common';

/** Mock AI Provider —— 开发阶段不消耗 API 额度 */
@Injectable()
export class MockAiProvider {
  private readonly logger = new Logger(MockAiProvider.name);

  async chatCompletion(_messages: unknown[], _options?: Record<string, unknown>) {
    this.logger.log('Mock chat completion');
    return { content: 'This is a mock AI response for development.' };
  }

  async videoGeneration(_params: Record<string, unknown>) {
    this.logger.log('Mock video generation');
    return { task_id: 'mock_task_' + Date.now() };
  }

  async textToSpeech(_params: Record<string, unknown>) {
    this.logger.log('Mock TTS');
    return { audio_url: 'https://example.com/mock-audio.mp3' };
  }
}
