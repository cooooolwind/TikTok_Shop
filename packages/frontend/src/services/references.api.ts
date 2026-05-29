import client from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  ReferenceVideo,
  CreateReferenceRequest,
  ReferenceListQuery,
} from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/references';

export const referencesApi = {
  create: async (data: CreateReferenceRequest) =>
    unwrapResponse<ReferenceVideo>(await client.post<unknown, ReferenceVideo | ApiResponse<ReferenceVideo>>(BASE, data)),
  list: async (params?: ReferenceListQuery) =>
    unwrapResponse<PaginatedResponse<ReferenceVideo>['data'] | PaginatedResponse<ReferenceVideo>>(
      await client.get<unknown, PaginatedResponse<ReferenceVideo> | ApiResponse<PaginatedResponse<ReferenceVideo>['data']>>(
        BASE,
        { params },
      ),
    ),
  detail: async (id: string) =>
    unwrapResponse<ReferenceVideo>(await client.get<unknown, ReferenceVideo | ApiResponse<ReferenceVideo>>(`${BASE}/${id}`)),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
};
