import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateVideoTaskInput {
  prompt: string;
  ratio: string;
  resolution: string;
  duration: number;
  imageUrls?: string[];
  firstFrameUrl?: string;
  referenceImageUrls?: string[];
}

export interface GenerateFirstFrameInput {
  prompt: string;
  referenceImages: string[];
  size?: string;
}

export interface GenerateFirstFrameResult {
  url: string;
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

interface VolcanoImageGenerationResponse {
  data?: { url?: string }[];
}

const DEFAULT_VIDEO_FETCH_TIMEOUT_MS = 60000;
const MIN_VIDEO_DURATION_SECONDS = 4;
const MAX_VIDEO_DURATION_SECONDS = 12;

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

  async generateFirstFrame(input: GenerateFirstFrameInput): Promise<GenerateFirstFrameResult> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      return {
        url:
          this.configService.get<string>('volcano.mockFirstFrameUrl') ||
          this.configService.get<string>('volcano.mockVideoThumbnailUrl') ||
          'https://example.com/mock-first-frame.png',
      };
    }

    const apiKey = this.configService.get<string>('volcano.imageApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.imageBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.imageEndpoint') ?? '';
    if (!apiKey || !model) {
      throw new Error('VOLCANO_IMAGE_API_KEY and VOLCANO_IMAGE_ENDPOINT are required');
    }

    const response = await this.postImageGeneration(baseUrl, apiKey, {
      model,
      prompt: input.prompt,
      image: input.referenceImages,
      size: input.size ?? '1600x2848',
      sequential_image_generation: 'disabled',
      watermark: false,
      response_format: 'url',
    });

    if (!response.ok) {
      throw this.toVolcanoRequestError('Volcano first-frame generation failed', response.status, await response.text());
    }

    const data = (await response.json()) as VolcanoImageGenerationResponse;
    const url = data.data?.[0]?.url;
    if (!url) throw new Error('Volcano first-frame generation returned empty url');
    return { url };
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
    const content = this.buildVideoContent(input, duration);

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      const response = await this.postVideoTask(baseUrl, apiKey, {
        model,
        content,
        return_last_frame: true,
      });

      if (response.ok) {
        const data = (await response.json()) as { id?: string };
        if (!data.id) throw new Error('Volcano video task creation returned empty id');
        return { id: data.id };
      }

      const errorText = await response.text();
      if (response.status === 404) {
        const fallbackResponse = await this.postVideoTask(baseUrl, apiKey, {
          model,
          content,
        });
        if (fallbackResponse.ok) {
          const data = (await fallbackResponse.json()) as { id?: string };
          if (!data.id) throw new Error('Volcano video task creation returned empty id');
          this.logger.warn('Volcano video task creation retried without return_last_frame after 404');
          return { id: data.id };
        }
      }

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

    const response = await this.fetchVideoTask(baseUrl, apiKey, taskId);

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

  private async postVideoTask(
    baseUrl: string,
    apiKey: string,
    body: {
      model: string;
      content: ReturnType<VolcanoClientProvider['buildVideoContent']>;
      return_last_frame?: true;
    },
  ) {
    try {
      return await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });
    } catch (error) {
      throw this.toVolcanoNetworkError('Volcano video task creation network failed', error);
    }
  }

  private async postImageGeneration(
    baseUrl: string,
    apiKey: string,
    body: {
      model: string;
      prompt: string;
      image: string[];
      size: string;
      sequential_image_generation: 'disabled';
      watermark: false;
      response_format: 'url';
    },
  ) {
    try {
      return await fetch(`${baseUrl.replace(/\/$/, '')}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });
    } catch (error) {
      throw this.toVolcanoNetworkError('Volcano first-frame generation network failed', error);
    }
  }

  private async fetchVideoTask(baseUrl: string, apiKey: string, taskId: string) {
    try {
      return await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });
    } catch (error) {
      throw this.toVolcanoNetworkError('Volcano video task query network failed', error);
    }
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

  private toVolcanoNetworkError(prefix: string, error: unknown) {
    const maybe = error as { message?: string; cause?: { message?: string; code?: string } };
    const details = [
      maybe.message || 'network request failed',
      maybe.cause?.message ? `cause=${maybe.cause.message}` : '',
      maybe.cause?.code ? `code=${maybe.cause.code}` : '',
    ].filter(Boolean);
    const wrapped = new Error(`${prefix}: ${details.join('; ')}`);
    Object.assign(wrapped, {
      code: maybe.cause?.code || 'VOLCANO_NETWORK_ERROR',
      retryable: true,
    });
    return wrapped;
  }

  private getVideoFetchTimeoutMs() {
    const configured = this.configService.get<number>('volcano.videoFetchTimeoutMs') ?? Number(process.env.VOLCANO_VIDEO_FETCH_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_VIDEO_FETCH_TIMEOUT_MS;
  }

  private normalizeVideoDuration(duration?: number) {
    const requested = Math.round(Number(duration) || MIN_VIDEO_DURATION_SECONDS);
    return Math.min(Math.max(requested, MIN_VIDEO_DURATION_SECONDS), MAX_VIDEO_DURATION_SECONDS);
  }

  private buildVideoContent(input: CreateVideoTaskInput, duration: number) {
    const content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
      role?: 'first_frame';
    }> = [
      {
        type: 'text',
        text: `${input.prompt} --duration ${duration} --ratio ${input.ratio} --camerafixed false --watermark false`,
      },
    ];

    if (input.firstFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: input.firstFrameUrl },
        role: 'first_frame',
      });
    }

    for (const url of input.referenceImageUrls ?? input.imageUrls ?? []) {
      content.push({
        type: 'image_url',
        image_url: { url },
      });
    }

    return content;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
