import client from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  GenerationTask,
  CreateVideoRequest,
  QuickGenerateRequest,
  RegenerateSceneVideoRequest,
  ExportRequest,
  ExportResponse,
  GenerationListQuery,
} from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/generation';

export const generationApi = {
  create: async (data: CreateVideoRequest) =>
    unwrapResponse<GenerationTask>(await client.post<unknown, GenerationTask | ApiResponse<GenerationTask>>(`${BASE}/create`, data)),
  quickCreate: async (data: QuickGenerateRequest) =>
    unwrapResponse<GenerationTask>(await client.post<unknown, GenerationTask | ApiResponse<GenerationTask>>(`${BASE}/quick`, data)),
  listTasks: async (params?: GenerationListQuery) =>
    unwrapResponse<PaginatedResponse<GenerationTask>['data'] | PaginatedResponse<GenerationTask>>(
      await client.get<unknown, PaginatedResponse<GenerationTask> | ApiResponse<PaginatedResponse<GenerationTask>['data']>>(
        `${BASE}/tasks`,
        { params },
      ),
    ),
  taskDetail: async (taskId: string) =>
    unwrapResponse<GenerationTask>(
      await client.get<unknown, GenerationTask | ApiResponse<GenerationTask>>(`${BASE}/tasks/${taskId}`),
    ),
  retry: async (taskId: string) =>
    unwrapResponse<GenerationTask>(
      await client.post<unknown, GenerationTask | ApiResponse<GenerationTask>>(`${BASE}/tasks/${taskId}/retry`),
    ),
  cancel: async (taskId: string) =>
    unwrapResponse<GenerationTask>(
      await client.post<unknown, GenerationTask | ApiResponse<GenerationTask>>(`${BASE}/tasks/${taskId}/cancel`),
    ),
  remove: (taskId: string) => client.delete<unknown, { message: string }>(`${BASE}/tasks/${taskId}`),
  regenerateScene: async (taskId: string, sceneId: string, data: RegenerateSceneVideoRequest) =>
    unwrapResponse<GenerationTask>(
      await client.post<unknown, GenerationTask | ApiResponse<GenerationTask>>(
        `${BASE}/tasks/${taskId}/scenes/${sceneId}/regenerate`,
        data,
      ),
    ),
  export: async (taskId: string, data: ExportRequest) =>
    unwrapResponse<ExportResponse>(
      await client.post<unknown, ExportResponse | ApiResponse<ExportResponse>>(`${BASE}/tasks/${taskId}/export`, data),
    ),
};
