import client from './client';
import type { HealthResponse, UploadResponse } from '@aigc/shared-types';

export const systemApi = {
  health: () => client.get<unknown, HealthResponse>('/health'),
  upload: (formData: FormData) =>
    client.post<unknown, UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
