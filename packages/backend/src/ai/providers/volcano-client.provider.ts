import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VolcanoClientProvider {
  private readonly logger = new Logger(VolcanoClientProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async chatCompletion(messages: unknown[], options?: Record<string, unknown>) {
    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.textEndpoint') ?? '';
    const mockMode = this.configService.get<boolean>('volcano.mockMode');

    if (mockMode) {
      return {
        content: JSON.stringify({
          narrative_framework: 'Hook - product benefits - CTA',
          visual_style: 'clean product demo',
          total_duration: 15,
          scenes: [
            {
              description: '展示商品核心卖点',
              camera_motion: 'fixed',
              duration: 5,
              dialogue: '这款商品适合你的日常使用。',
              bgm_style: 'upbeat',
              subtitle: '核心卖点展示',
              visual_prompt: 'Product close-up, clean lighting',
              constraints: [],
            },
          ],
        }),
      };
    }

    if (!apiKey || !model) {
      throw new Error('VOLCANO_TEXT_API_KEY and VOLCANO_TEXT_ENDPOINT are required');
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Volcano chat completion failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Volcano chat completion returned empty content');
    return { content };
  }

  async stubChatCompletion() {
    const endpoint = this.configService.get<string>('volcano.textEndpoint') ?? 'stub';
    this.logger.log(`Volcano chat completion - stub (${endpoint})`);
    return { content: 'stub response' };
  }

  async videoGeneration(_params: Record<string, unknown>) {
    const endpoint = this.configService.get<string>('volcano.videoEndpoint') ?? 'stub';
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'stub';
    this.logger.log(`Volcano video generation - stub (${baseUrl}, ${endpoint})`);
    return { task_id: 'stub' };
  }

  async textToSpeech(_params: Record<string, unknown>) {
    this.logger.log('Volcano TTS - stub');
    return { audio_url: 'stub' };
  }
}
