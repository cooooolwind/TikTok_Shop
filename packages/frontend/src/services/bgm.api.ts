import client from './client';
import type { BGM, BGMListQuery } from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/bgm';

export const bgmApi = {
  list: async (params?: BGMListQuery) => unwrapResponse<BGM[]>(await client.get(BASE, { params })),
};
