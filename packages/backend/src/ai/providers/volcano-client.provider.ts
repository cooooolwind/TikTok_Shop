import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateVideoTaskInput {
  prompt: string;
  ratio: string;
  resolution: string;
  duration: number;
  imageUrl?: string;
}

export interface CreateVideoTaskResult {
  task_id: string;
}

export interface GetVideoTaskResult {
  task_id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  video_url?: string;
  video_thumbnail_url?: string;
  error_code?: string;
  error_message?: string;
}

export interface GenerateFirstFrameInput {
  prompt: string;
  ratio: string;
}

export interface GenerateFirstFrameResult {
  imageUrl: string;
}

const DEFAULT_VIDEO_FETCH_TIMEOUT_MS = 60000;

@Injectable()
export class VolcanoClientProvider {
  private readonly logger = new Logger(VolcanoClientProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async generateChat(messages: any[], options?: any) {
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

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to generate chat: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(fileBuffer: Buffer, filename: string) {
    const apiKey = this.configService.get<string>('volcano.textApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.textBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) throw new Error('VOLCANO_TEXT_API_KEY is required for file upload');

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, filename);
    formData.append('purpose', 'fine-tune');

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

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw error;
    }
  }

  async retrieveFile(fileId: string) {
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
    } catch (error) {
      this.logger.error(`Failed to retrieve file: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileId: string) {
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
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }

  async listFiles() {
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
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`);
      throw error;
    }
  }

  async generateFirstFrame(input: GenerateFirstFrameInput): Promise<GenerateFirstFrameResult> {
    if (this.configService.get<boolean>('mockMode')) {
      const mockUrl = this.configService.get<string>('volcano.mockFirstFrameUrl');
      return { imageUrl: mockUrl || 'https://example.com/mock-first-frame.png' };
    }

    const apiKey = this.configService.get<string>('volcano.imageApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.imageBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.imageEndpoint') ?? '';

    if (!apiKey || !model) {
      this.logger.error('VOLCANO_IMAGE_API_KEY or VOLCANO_IMAGE_ENDPOINT is missing');
      throw new Error('Volcano Image configuration is missing');
    }

    const response = await this.postImageGeneration(baseUrl, apiKey, {
      model,
      prompt: input.prompt,
      render_size: input.ratio === '16:9' ? '1280x720' : '720x1280',
    });

    if (response.data?.[0]?.url) {
      return { imageUrl: response.data[0].url };
    }

    throw new Error(`Failed to generate first frame: ${JSON.stringify(response)}`);
  }

  async createVideoTask(input: CreateVideoTaskInput): Promise<CreateVideoTaskResult> {
    if (this.configService.get<boolean>('mockMode')) {
      return { task_id: `mock-task-${Date.now()}` };
    }

    const apiKey = this.configService.get<string>('volcano.videoApiKey') ?? '';
    const baseUrl = this.configService.get<string>('volcano.videoBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3';
    const model = this.configService.get<string>('volcano.videoEndpoint') ?? '';

    if (!apiKey || !model) {
      this.logger.error('VOLCANO_VIDEO_API_KEY or VOLCANO_VIDEO_ENDPOINT is missing');
      throw new Error('Volcano Video configuration is missing');
    }

    const retryAttempts = this.configService.get<number>('volcano.videoCreateRetryAttempts') || 3;
    const retryDelay = this.configService.get<number>('volcano.videoCreateRetryDelayMs') || 15000;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const response = await this.postVideoGeneration(baseUrl, apiKey, {
          model,
          content: this.buildVideoContent(input),
          render_spec: {
            duration: this.normalizeVideoDuration(input.duration),
            fps: 25,
            aspect_ratio: input.ratio === '16:9' ? '16:9' : '9:16',
          },
        });

        if (response.id) {
          return { task_id: response.id };
        }

        throw new Error(`Unexpected video task creation response: ${JSON.stringify(response)}`);
      } catch (error: any) {
        const isRateLimit = error.message?.includes('429');
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
    if (this.configService.get<boolean>('mockMode')) {
      return {
        task_id: taskId,
        status: 'success',
        video_url: this.configService.get<string>('volcano.mockVideoUrl'),
        video_thumbnail_url: this.configService.get<string>('volcano.mockVideoThumbnailUrl'),
      };
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
    } catch (error) {
      this.logger.error(`Failed to get video task: ${error.message}`);
      throw error;
    }
  }

  private mapVideoTaskResult(result: any): GetVideoTaskResult {
    const statusMap: Record<string, GetVideoTaskResult['status']> = {
      pending: 'pending',
      running: 'running',
      succeeded: 'success',
      failed: 'failed',
    };

    return {
      task_id: result.id,
      status: statusMap[result.status] || 'failed',
      video_url: result.result?.video_url,
      video_thumbnail_url: result.result?.video_thumbnail_url,
      error_code: result.error?.code,
      error_message: result.error?.message,
    };
  }

  private buildVideoContent(input: CreateVideoTaskInput) {
    const content: any[] = [{ type: 'text', text: input.prompt }];
    if (input.imageUrl) {
      content.push({ type: 'image_url', image_url: { url: input.imageUrl } });
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

  private async postVideoGeneration(baseUrl: string, apiKey: string, body: any) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contents/generations/tasks`, {
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
    return Math.min(Math.max(duration, 2), 15);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
