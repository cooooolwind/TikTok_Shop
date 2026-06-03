import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class VolcanoClientProvider {
  private readonly logger = new Logger(VolcanoClientProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async generateChat(messages: any[], options?: any): Promise<VolcanoChatCompletionResult> {
    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.textEndpoint') ?? '';

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
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
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

    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.textEndpoint') ?? '';

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
        signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
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

  async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
    if (this.configService.get<boolean>('volcano.mockMode')) {
      this.logger.log('Mock mode: returning simulated file upload ID');
      return `mock-file-${Date.now()}`;
    }

    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
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

    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
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

    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
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
    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
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

    const apiKey = this.configService.get<string>('volcano.imageApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.imageBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.imageEndpoint') ?? '';

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

    const apiKey = this.configService.get<string>('volcano.videoApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.videoEndpoint') ?? '';

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
          signal: AbortSignal.timeout(this.getVideoFetchTimeoutMs()),
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

    const apiKey = this.configService.get<string>('volcano.videoApiKey') ?? '';
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
    const statusMap: Record<string, GetVideoTaskResult['status']> = {
      pending: 'pending',
      running: 'running',
      succeeded: 'succeeded',
      failed: 'failed',
    };

    return {
      ...result,
      id: result.id,
      status: statusMap[result.status] || 'failed',
      video_url: result.result?.video_url || result.content?.video_url,
      video_thumbnail_url: result.result?.video_thumbnail_url || result.content?.last_frame_url,
      error_code: result.error?.code,
      error_message: result.error?.message,
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
}
