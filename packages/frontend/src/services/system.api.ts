import client from './client';
import type { HealthResponse, UploadResponse, SetTempApiKeyDto, TempApiKeyResponse, ApiResponse } from '@aigc/shared-types';
import { unwrapResponse } from './response';

export const systemApi = {
  health: () => client.get<unknown, HealthResponse>('/health'),
  upload: (formData: FormData) =>
    client.post<unknown, UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getTempApiKey: async () => unwrapResponse<TempApiKeyResponse>(await client.get<unknown, TempApiKeyResponse | ApiResponse<TempApiKeyResponse>>('/ai/settings/temp-key')),
  setTempApiKey: async (dto: SetTempApiKeyDto) => unwrapResponse<TempApiKeyResponse>(await client.post<unknown, TempApiKeyResponse | ApiResponse<TempApiKeyResponse>>('/ai/settings/temp-key', dto)),
};
