import client from './client';
import type { PaginatedResponse, Material, MaterialDetail, MaterialListQuery, SimilarSearchRequest, SimilarSearchResult } from '@aigc/shared-types';

const BASE = '/materials';

export const materialsApi = {
  list: (params?: MaterialListQuery) => client.get<unknown, PaginatedResponse<Material>>(BASE, { params }),
  detail: (id: string) => client.get<unknown, MaterialDetail>(`${BASE}/${id}`),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
  batchRemove: (ids: string[]) => client.delete<unknown, { message: string }>(`${BASE}/batch`, { data: { ids } }),
  analyze: (id: string) => client.post<unknown, { task_id: string; status: string }>(`${BASE}/${id}/analyze`),
  slices: (id: string) => client.get<unknown, unknown[]>(`${BASE}/${id}/slices`),
  searchSimilar: (data: SimilarSearchRequest) => client.post<unknown, SimilarSearchResult[]>(`${BASE}/search/similar`, data),
};
