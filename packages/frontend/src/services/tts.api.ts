import client from './client';
import type { Voice, TTSPreviewRequest, TTSPreviewResponse } from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/tts';

export const ttsApi = {
  voices: async () => unwrapResponse<Voice[]>(await client.get(`${BASE}/voices`)),
  preview: (data: TTSPreviewRequest) => client.post<unknown, TTSPreviewResponse>(`${BASE}/preview`, data),
};
