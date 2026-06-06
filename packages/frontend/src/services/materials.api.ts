import client from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Material,
  MaterialDetail,
  MaterialListQuery,
  MaterialUploadResponse,
  SimilarSearchRequest,
  SimilarSearchResult,
  EmbeddingBackfillResponse,
} from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/materials';

export const materialsApi = {
  upload: async (formData: FormData) =>
    unwrapResponse<MaterialUploadResponse>(
      await client.post<unknown, MaterialUploadResponse | ApiResponse<MaterialUploadResponse>>(`${BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    ),
  list: async (params?: MaterialListQuery) =>
    unwrapResponse<PaginatedResponse<Material>['data'] | PaginatedResponse<Material>>(
      await client.get<unknown, PaginatedResponse<Material> | ApiResponse<PaginatedResponse<Material>['data']>>(BASE, {
        params,
      }),
    ),
  detail: async (id: string) =>
    unwrapResponse<MaterialDetail>(await client.get<unknown, MaterialDetail | ApiResponse<MaterialDetail>>(`${BASE}/${id}`)),
  update: async (id: string, data: Partial<Material>) =>
    unwrapResponse<Material>(await client.put<unknown, Material | ApiResponse<Material>>(`${BASE}/${id}`, data)),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
  batchRemove: (ids: string[]) => client.delete<unknown, { message: string }>(`${BASE}/batch`, { data: { ids } }),
  analyze: async (id: string) =>
    unwrapResponse<{ task_id: string; status: string }>(
      await client.post<unknown, { task_id: string; status: string } | ApiResponse<{ task_id: string; status: string }>>(
        `${BASE}/${id}/analyze`,
      ),
    ),
  slices: async (id: string) =>
    unwrapResponse<unknown[]>(await client.get<unknown, unknown[] | ApiResponse<unknown[]>>(`${BASE}/${id}/slices`)),
  searchSimilar: async (data: SimilarSearchRequest) =>
    unwrapResponse<SimilarSearchResult[]>(
      await client.post<unknown, SimilarSearchResult[] | ApiResponse<SimilarSearchResult[]>>(`${BASE}/search/similar`, data),
    ),
  backfillEmbeddings: async (materialIds?: string[]) =>
    unwrapResponse<EmbeddingBackfillResponse>(
      await client.post<unknown, EmbeddingBackfillResponse | ApiResponse<EmbeddingBackfillResponse>>(`${BASE}/search/backfill`, {
        materialIds,
      }),
    ),
  reEmbed: async (id: string) =>
    unwrapResponse<{ id: string; has_embedding: boolean; error?: string }>(
      await client.post<unknown, { id: string; has_embedding: boolean; error?: string } | ApiResponse<{ id: string; has_embedding: boolean; error?: string }>>(
        `${BASE}/${id}/re-embed`,
      ),
    ),
};