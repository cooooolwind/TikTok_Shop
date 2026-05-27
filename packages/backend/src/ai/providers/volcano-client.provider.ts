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

interface VolcanoErrorBody {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
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
          total_duration: 12,
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

    const retryAttempts = this.configService.get<number>('volcano.videoCreateRetryAttempts') ?? 3;
    const retryDelayMs = this.configService.get<number>('volcano.videoCreateRetryDelayMs') ?? 15000;
    const duration = this.normalizeVideoDuration(input.duration);

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          content: [
            {
              type: 'text',
              text: `${input.prompt} --duration ${duration} --ratio ${input.ratio} --camerafixed false --watermark false`,
            },
            ...(input.imageUrls ?? []).map((url) => ({
              type: 'image_url',
              image_url: { url },
            })),
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { id?: string };
        if (!data.id) throw new Error('Volcano video task creation returned empty id');
        return { id: data.id };
      }

      const errorText = await response.text();
      if (response.status === 429 && attempt < retryAttempts) {
        const delayMs = this.getRetryDelayMs(response, retryDelayMs, attempt);
        this.logger.warn(`Volcano video task creation rate limited; retrying in ${delayMs}ms`);
        await this.sleep(delayMs);
        continue;
      }

      throw this.toVolcanoRequestError('Volcano video task creation failed', response.status, errorText);
    }

    throw new Error('Volcano video task creation failed after retries');
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

  private getRetryDelayMs(response: Response, fallbackDelayMs: number, attempt: number) {
    const retryAfter = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return retryAfterSeconds * 1000;
    }
    return fallbackDelayMs * Math.pow(2, attempt);
  }

  private toVolcanoRequestError(prefix: string, status: number, bodyText: string) {
    let parsed: VolcanoErrorBody | null = null;
    try {
      parsed = JSON.parse(bodyText) as VolcanoErrorBody;
    } catch {
      parsed = null;
    }
    const error = new Error(`${prefix}: ${status} ${bodyText}`);
    Object.assign(error, {
      code: parsed?.error?.code,
      status,
      retryable: status === 429,
    });
    return error;
  }

  private normalizeVideoDuration(duration?: number) {
    const requested = Math.round(Number(duration) || 5);
    return requested <= 5 ? 5 : 10;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
