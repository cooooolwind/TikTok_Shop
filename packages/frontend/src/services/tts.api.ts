import client from './client';
import type { Voice, TTSPreviewRequest, TTSPreviewResponse } from '@aigc/shared-types';

const BASE = '/tts';

export const ttsApi = {
  voices: () => client.get<unknown, Voice[]>(`${BASE}/voices`),
  preview: (data: TTSPreviewRequest) => client.post<unknown, TTSPreviewResponse>(`${BASE}/preview`, data),
};
