import type { ApiResponse, MyVideo, SaveMyVideoRequest } from '@aigc/shared-types';
import client from './client';
import { unwrapResponse } from './response';

const BASE = '/my-videos';

export const myVideosApi = {
  list: async () => unwrapResponse<MyVideo[]>(await client.get<unknown, MyVideo[] | ApiResponse<MyVideo[]>>(BASE)),
  create: async (data: SaveMyVideoRequest) =>
    unwrapResponse<MyVideo>(await client.post<unknown, MyVideo | ApiResponse<MyVideo>>(BASE, data)),
};
