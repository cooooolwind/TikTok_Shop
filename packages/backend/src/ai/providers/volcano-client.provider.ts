import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiSettingsService } from '../services/ai-settings.service';

export interface CreateVideoTaskInput {
  prompt: string;
  ratio: string;
  resolution: string;
  duration: number;
  imageUrl?: string;
  imageUrls?: string[];
  referenceImageUrls?: string[];
  firstFrameUrl?: string;
}

export interface CreateVideoTaskResult {
  id: string;
  task_id: string;
}

export interface VolcanoVideoTask {
  id: string;
  task_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  duration?: number;
  ratio?: string;
  resolution?: string;
  content?: {
    video_url?: string;
    file_url?: string;
    last_frame_url?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface GetVideoTaskResult extends VolcanoVideoTask {
  video_url?: string;
  video_thumbnail_url?: string;
  error_code?: string;
  error_message?: string;
}

export interface GenerateFirstFrameInput {
  prompt: string;
  ratio?: string;
  referenceImages?: string[];
  size?: string;
}

export interface GenerateFirstFrameResult {
  url: string;
  imageUrl: string;
}

export interface VolcanoChatCompletionResult {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_VIDEO_FETCH_TIMEOUT_MS = 60000;
const DEFAULT_CHAT_TIMEOUT_MS = 180000;

@Injectable()
export class VolcanoClientProvider {
  private readonly logger = new Logger(VolcanoClientProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  async generateChat(messages: any[], options?: any): Promise<VolcanoChatCompletionResult> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: returning simulated chat completion response');
      const mockContent = JSON.stringify({
        script_blueprint: {
          basic_setting: 'Mock 商品短视频基础设定，商品主体清晰可见。',
          atmosphere_and_quality: '明亮真实的电商短视频质感，画面干净，产品突出。',
          audio: '轻快同期声，可根据台词生成口播。',
          scenes: [
            {
              order: 1,
              time_range: '00:00-00:04',
              shot_size: '近景',
              composition: '商品居中，背景简洁',
              camera_movement: '缓慢推进',
              visual_content: '展示商品外观和核心卖点。',
              audio: '轻快同期声。',
              dialogue: '这款商品让日常使用更轻松。',
              subtitle: '日常使用更轻松',
            },
          ],
        },
        narrative_framework: 'Hook - 卖点展示 - CTA',
        visual_style: '真实电商短视频',
        total_duration: 4,
        scenes: [
          {
            description: '展示商品外观和核心卖点。',
            camera_motion: '缓慢推进',
            duration: 4,
            dialogue: '这款商品让日常使用更轻松。',
            bgm_style: '轻快同期声',
            subtitle: '日常使用更轻松',
            visual_prompt: '近景，商品居中，背景简洁，展示商品外观和核心卖点。',
            constraints: ['商品清晰可见', '不要生成画面文字'],
          },
        ],
      });
      return {
        choices: [{ message: { role: 'assistant', content: mockContent }, finish_reason: 'stop' }],
        content: mockContent,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    }

    const apiKey = this.getTextApiKey();
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.getTextEndpoint();

    if (!apiKey || !model) {
      this.logger.error('VOLCANO_TEXT_API_KEY or VOLCANO_TEXT_ENDPOINT is missing');
      throw new Error('Volcano Text configuration is missing');
    }

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          ...options,
        }),
        signal: AbortSignal.timeout(this.getChatTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      const result: any = await response.json();
      return {
        ...result,
        content: result.choices?.[0]?.message?.content || '',
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate chat: ${error.message}${(error as any).cause ? `; cause=${(error as any).cause.message}` : ''}`);
      throw error;
    }
  }

  async chatCompletion(messages: any[], options?: any): Promise<VolcanoChatCompletionResult> {
    return this.generateChat(messages, options);
  }

  async createResponse(input: any, options?: any): Promise<VolcanoChatCompletionResult> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: returning simulated multimodal analysis response');
      const mockContent = JSON.stringify({
        tags: ['mock-tag-1', 'mock-tag-2', 'mock-tag-3'],
        description: 'Mock 分析描述：这是一个模拟的多模态分析结果。',
        slices: [
          { start_time: 0, end_time: 5, description: '模拟场景1', tags: ['mock-slice'] },
          { start_time: 5, end_time: 10, description: '模拟场景2', tags: ['mock-slice'] },
        ],
      });
      return {
        choices: [{ message: { role: 'assistant', content: mockContent }, finish_reason: 'stop' }],
        content: mockContent,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    }

    const apiKey = this.getTextApiKey();
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.getTextEndpoint();

    if (!apiKey || !model) {
      this.logger.error('VOLCANO_TEXT_API_KEY or VOLCANO_TEXT_ENDPOINT is missing');
      throw new Error('Volcano Text configuration is missing');
    }

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input,
          ...options,
        }),
        signal: AbortSignal.timeout(this.getChatTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      const result: any = await response.json();
      this.logger.debug(`Responses API response keys: ${Object.keys(result).join(',')}, has output: ${Array.isArray(result.output)}, output length: ${result.output?.length ?? 'N/A'}`);

      // Responses API uses different format: output[].content[].text
      let content = '';
      if (Array.isArray(result.output)) {
        for (const item of result.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (block.type === 'output_text' && typeof block.text === 'string') {
                content += block.text;
              }
            }
          }
        }
      }
      // Fallback to Chat Completions format if Responses API format yielded nothing
      if (!content && result.choices?.[0]?.message?.content) {
        content = result.choices[0].message.content;
      }

      if (!content) {
        this.logger.warn(`No content extracted from Responses API. Response structure: ${JSON.stringify(Object.keys(result))}`);
      }

      return {
        ...result,
        content,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create response: ${error.message}${(error as any).cause ? `; cause=${(error as any).cause.message}` : ''}`);
      throw error;
    }
  }

  async generateEmbedding(
    inputs: Array<{ type: 'text'; text: string } | { type: 'image_url'; url: string } | { type: 'video_url'; url: string }>,
    options?: { dimensions?: number },
  ): Promise<number[]> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: returning simulated embedding vector');
      const dim = options?.dimensions ?? this.configService.get<number>('volcano.embeddingDimensions') ?? 2048;
      return Array.from({ length: dim }, () => Math.random() * 0.01);
    }

    const apiKey = this.getEmbeddingApiKey();
    const baseUrl = this.configService.get<string>('volcano.embeddingBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.getEmbeddingEndpoint();

    if (!apiKey || !model) {
      throw new Error('VOLCANO_EMBEDDING_API_KEY and VOLCANO_EMBEDDING_ENDPOINT are required for embedding generation');
    }

    const dimensions = options?.dimensions ?? this.configService.get<number>('volcano.embeddingDimensions') ?? 2048;

    const body: Record<string, unknown> = {
      model,
      input: inputs.map((input) => {
        if (input.type === 'text') {
          return { type: 'text', text: input.text };
        }
        if (input.type === 'image_url') {
          return { type: 'image_url', image_url: { url: input.url } };
        }
        return { type: 'video_url', video_url: { url: (input as { type: 'video_url'; url: string }).url } };
      }),
      dimensions,
    };

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings/multimodal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano Embedding API error: ${JSON.stringify(error)}`);
      }

      const result: any = await response.json();
      const embedding = result.data?.embedding;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error(`Unexpected embedding response format: ${JSON.stringify(Object.keys(result))}`);
      }

      return embedding as number[];
    } catch (error: any) {
      this.logger.error(`Failed to generate embedding: ${error.message}${(error as any).cause ? `; cause=${(error as any).cause.message}` : ''}`);
      throw error;
    }
  }

  async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: returning simulated file upload ID');
      return `mock-file-${Date.now()}`;
    }

    const apiKey = this.getTextApiKey();
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) throw new Error('VOLCANO_TEXT_API_KEY is required for file upload');

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, filename);
    formData.append('purpose', 'user_data');

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      const result: any = await response.json();
      return result.id;
    } catch (error: any) {
      this.logger.error(`Failed to upload file: ${error.message}${(error as any).cause ? `; cause=${(error as any).cause.message}` : ''}`);
      throw error;
    }
  }

  async retrieveFile(fileId: string): Promise<any> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: returning simulated file status');
      return { id: fileId, status: 'active' };
    }

    const apiKey = this.getTextApiKey();
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) throw new Error('VOLCANO_TEXT_API_KEY is required for file retrieval');

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/files/${fileId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error(`Failed to retrieve file: ${error.message}${(error as any).cause ? `; cause=${(error as any).cause.message}` : ''}`);
      throw error;
    }
  }

  async getFile(fileId: string): Promise<any> {
    return this.retrieveFile(fileId);
  }

  async deleteFile(fileId: string): Promise<any> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: simulating file deletion');
      return { id: fileId, deleted: true };
    }

    const apiKey = this.getTextApiKey();
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) throw new Error('VOLCANO_TEXT_API_KEY is missing');

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error(`Failed to delete file: ${error.message}${(error as any).cause ? `; cause=${(error as any).cause.message}` : ''}`);
      throw error;
    }
  }

  async listFiles(): Promise<any> {
    const apiKey = this.getTextApiKey();
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) return;

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/files`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error(`Failed to list files: ${error.message}`);
      throw error;
    }
  }

  async generateFirstFrame(input: GenerateFirstFrameInput): Promise<GenerateFirstFrameResult> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      const mockUrl = this.configService.get<string>('volcano.mockFirstFrameUrl') || 'https://example.com/mock-first-frame.png';
      return { url: mockUrl, imageUrl: mockUrl } as any;
    }

    const apiKey = this.getImageApiKey();
    const baseUrl = this.configService.get<string>('volcano.imageBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.getImageEndpoint();

    if (!apiKey || !model) {
      this.logger.error('VOLCANO_IMAGE_API_KEY or VOLCANO_IMAGE_ENDPOINT is missing');
      throw new Error('Volcano Image configuration is missing');
    }

    const response: any = await this.postImageGeneration(baseUrl, apiKey, {
      model,
      prompt: input.prompt,
      image: input.referenceImages || [],
      size: input.size || '1600x2848',
      sequential_image_generation: 'disabled',
      watermark: false,
      response_format: 'url',
    });

    if (response.data?.[0]?.url) {
      return { url: response.data[0].url } as any;
    }

    throw new Error(`Failed to generate first frame: ${JSON.stringify(response)}`);
  }

  async createVideoTask(input: CreateVideoTaskInput): Promise<CreateVideoTaskResult> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      return { id: 'mock_video_task' } as any;
    }

    const apiKey = this.getVideoApiKey();
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.getVideoEndpoint();

    if (!apiKey || !model) {
      throw new Error('VOLCANO_VIDEO_API_KEY and VOLCANO_VIDEO_ENDPOINT are required');
    }

    const retryAttempts = this.configService.get<number>('volcano.videoCreateRetryAttempts') ?? 3;
    const retryDelay = this.configService.get<number>('volcano.videoCreateRetryDelayMs') ?? 15000;

    let useLastFrame = true;
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const body: any = {
          model,
          content: this.buildVideoContent(input),
        };
        if (useLastFrame) {
          body.return_last_frame = true;
        }

        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.getChatTimeoutMs()),
        });

        if (response.status === 404 && useLastFrame) {
          useLastFrame = false;
          attempt--; // Retry immediately without last frame
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
        }

        const result: any = await response.json();
        if (result.id) {
          return { id: result.id } as any;
        }

        throw new Error(`Unexpected video task creation response: ${JSON.stringify(result)}`);
      } catch (error: any) {
        if (error instanceof TypeError && (error.message === 'fetch failed' || error.message.includes('network'))) {
          const cause = (error as any).cause;
          throw new Error(`Volcano video task creation network failed: fetch failed; cause=${cause?.message}; code=${cause?.code}`);
        }

        const isRateLimit = error.message?.includes('429') || error.message?.includes('TooManyRequests') || error.message?.includes('RPM limit exceeded');
        const isRetryable = isRateLimit || attempt < retryAttempts;

        if (isRetryable) {
          this.logger.warn(
            `Volcano video task creation ${isRateLimit ? 'rate limited' : 'failed'}; retrying in ${attempt * retryDelay}ms`,
          );
          await this.sleep(attempt * retryDelay);
          continue;
        }
        
        throw error;
      }
    }

    throw new Error('Failed to create video task after retries');
  }

  async getVideoTask(taskId: string): Promise<GetVideoTaskResult> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      return {
        id: taskId,
        status: 'succeeded',
        content: {
          video_url: this.configService.get<string>('volcano.mockVideoUrl'),
          last_frame_url: this.configService.get<string>('volcano.mockVideoThumbnailUrl'),
        },
      } as any;
    }

    const apiKey = this.getVideoApiKey();
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
      }

      const result = await response.json();
      return this.mapVideoTaskResult(result);
    } catch (error: any) {
      this.logger.error(`Failed to get video task: ${error.message}`);
      throw error;
    }
  }

  private mapVideoTaskResult(result: any): GetVideoTaskResult {
    const providerError =
      result.error ||
      result.last_error ||
      result.failure_reason ||
      result.reason ||
      result.message;
    const statusMap: Record<string, GetVideoTaskResult['status']> = {
      pending: 'pending',
      queued: 'pending',
      queueing: 'pending',
      scheduled: 'pending',
      running: 'running',
      processing: 'running',
      in_progress: 'running',
      succeeded: 'succeeded',
      failed: 'failed',
      expired: 'expired',
      cancelled: 'cancelled',
    };

    return {
      ...result,
      id: result.id,
      status: statusMap[result.status] || 'failed',
      video_url: result.result?.video_url || result.content?.video_url,
      video_thumbnail_url: result.result?.video_thumbnail_url || result.content?.last_frame_url,
      error_code: typeof providerError === 'object' ? providerError?.code : undefined,
      error_message:
        typeof providerError === 'object'
          ? providerError?.message || JSON.stringify(providerError)
          : providerError,
    } as any;
  }

  private buildVideoContent(input: CreateVideoTaskInput) {
    const prompt = `${input.prompt} --duration ${this.normalizeVideoDuration(input.duration)} --ratio ${input.ratio} --camerafixed false --watermark false`;
    const content: any[] = [{ type: 'text', text: prompt }];
    
    if (input.firstFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: input.firstFrameUrl },
        role: 'first_frame',
      });
    }

    const referenceImages = input.imageUrls || input.referenceImageUrls || [];
    for (const url of referenceImages) {
      content.push({ type: 'image_url', image_url: { url } });
    }

    return content;
  }

  private async postImageGeneration(baseUrl: string, apiKey: string, body: any) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Volcano API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  private getChatTimeoutMs() {
    const configured = this.configService.get<number>('volcano.chatTimeoutMs');
    return Number.isFinite(configured) && configured && configured > 0
      ? configured
      : DEFAULT_CHAT_TIMEOUT_MS;
  }

  private getVideoFetchTimeoutMs() {
    const configured = this.configService.get<number>('volcano.videoFetchTimeoutMs');
    return Number.isFinite(configured) && configured && configured > 0
      ? configured
      : DEFAULT_VIDEO_FETCH_TIMEOUT_MS;
  }

  private normalizeVideoDuration(duration?: number) {
    if (!duration) return 5;
    return Math.min(Math.max(duration, 4), 12);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getTextApiKey(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_text_api_key || temp.volcano_api_key || this.configService.get<string>('volcano.textApiKey') || '';
  }

  private getTextEndpoint(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_text_endpoint || this.configService.get<string>('volcano.textEndpoint') || '';
  }

  private getImageApiKey(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_image_api_key || temp.volcano_api_key || this.configService.get<string>('volcano.imageApiKey') || '';
  }

  private getImageEndpoint(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_image_endpoint || this.configService.get<string>('volcano.imageEndpoint') || '';
  }

  private getVideoApiKey(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_video_api_key || temp.volcano_api_key || this.configService.get<string>('volcano.videoApiKey') || '';
  }

  private getVideoEndpoint(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_video_endpoint || this.configService.get<string>('volcano.videoEndpoint') || '';
  }

  private getEmbeddingApiKey(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_embedding_api_key || temp.volcano_api_key || this.configService.get<string>('volcano.embeddingApiKey') || '';
  }

  private getEmbeddingEndpoint(): string {
    const temp = this.aiSettingsService.getTempSettings();
    return temp.volcano_embedding_endpoint || this.configService.get<string>('volcano.embeddingEndpoint') || '';
  }
}
