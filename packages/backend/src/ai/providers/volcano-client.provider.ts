import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateVideoTaskInput {
  prompt: string;
  ratio: string;
  resolution: string;
  duration: number;
  imageUrls?: string[];
}

export interface VolcanoVideoTask {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  content?: {
    video_url?: string;
    last_frame_url?: string;
    file_url?: string | null;
  };
  error?: {
    code?: string;
    message?: string;
  } | null;
  duration?: number;
  resolution?: string;
  ratio?: string;
}

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

  async createVideoTask(input: CreateVideoTaskInput): Promise<{ id: string }> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      return { id: 'mock_video_task' };
    }

    const apiKey = this.configService.get<string>('volcano.videoApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.videoEndpoint') ?? '';
    if (!apiKey || !model) {
      throw new Error('VOLCANO_VIDEO_API_KEY and VOLCANO_VIDEO_ENDPOINT are required');
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        content: [{ type: 'text', text: input.prompt }],
        parameters: {
          duration: input.duration,
          ratio: input.ratio,
          resolution: input.resolution,
        },
        ...(input.imageUrls?.length
          ? { image_urls: input.imageUrls }
          : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Volcano video task creation failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) throw new Error('Volcano video task creation returned empty id');
    return { id: data.id };
  }

  async getVideoTask(taskId: string): Promise<VolcanoVideoTask> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      return {
        id: taskId,
        status: 'succeeded',
        content: {
          video_url:
            this.configService.get<string>('volcano.mockVideoUrl') ||
            'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          last_frame_url: this.configService.get<string>('volcano.mockVideoThumbnailUrl') || '',
        },
        duration: 8,
        resolution: '1080p',
        ratio: '9:16',
      };
    }

    const apiKey = this.configService.get<string>('volcano.videoApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    if (!apiKey) throw new Error('VOLCANO_VIDEO_API_KEY is required');

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Volcano video task query failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as VolcanoVideoTask;
  }

  async textToSpeech(_params: Record<string, unknown>) {
    this.logger.log('Volcano TTS - stub');
    return { audio_url: 'stub' };
  }

}
