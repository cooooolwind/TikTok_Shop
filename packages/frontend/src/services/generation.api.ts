import client from './client';
import type {
  PaginatedResponse,
  GenerationTask,
  CreateVideoRequest,
  QuickGenerateRequest,
  RegenerateSceneVideoRequest,
  ExportRequest,
  ExportResponse,
  GenerationListQuery,
} from '@aigc/shared-types';

const BASE = '/generation';

export const generationApi = {
  create: (data: CreateVideoRequest) => client.post<unknown, GenerationTask>(`${BASE}/create`, data),
  quickCreate: (data: QuickGenerateRequest) => client.post<unknown, GenerationTask>(`${BASE}/quick`, data),
  listTasks: (params?: GenerationListQuery) =>
    client.get<unknown, PaginatedResponse<GenerationTask>>(`${BASE}/tasks`, { params }),
  taskDetail: (taskId: string) => client.get<unknown, GenerationTask>(`${BASE}/tasks/${taskId}`),
  retry: (taskId: string) => client.post<unknown, GenerationTask>(`${BASE}/tasks/${taskId}/retry`),
  cancel: (taskId: string) => client.post<unknown, GenerationTask>(`${BASE}/tasks/${taskId}/cancel`),
  remove: (taskId: string) => client.delete<unknown, { message: string }>(`${BASE}/tasks/${taskId}`),
  regenerateScene: (taskId: string, sceneId: string, data: RegenerateSceneVideoRequest) =>
    client.post<unknown, GenerationTask>(`${BASE}/tasks/${taskId}/scenes/${sceneId}/regenerate`, data),
  export: (taskId: string, data: ExportRequest) =>
    client.post<unknown, ExportResponse>(`${BASE}/tasks/${taskId}/export`, data),
};
