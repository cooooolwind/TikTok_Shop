import client from './client';
import type { PaginatedResponse, ReferenceVideo, CreateReferenceRequest, ReferenceListQuery } from '@aigc/shared-types';

const BASE = '/references';

export const referencesApi = {
  create: (data: CreateReferenceRequest) => client.post<unknown, ReferenceVideo>(BASE, data),
  list: (params?: ReferenceListQuery) => client.get<unknown, PaginatedResponse<ReferenceVideo>>(BASE, { params }),
  detail: (id: string) => client.get<unknown, ReferenceVideo>(`${BASE}/${id}`),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
};
