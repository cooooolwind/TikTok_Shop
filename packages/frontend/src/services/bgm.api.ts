import client from './client';
import type { BGM, BGMListQuery } from '@aigc/shared-types';

const BASE = '/bgm';

export const bgmApi = {
  list: (params?: BGMListQuery) => client.get<unknown, BGM[]>(BASE, { params }),
};
