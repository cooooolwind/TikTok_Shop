import client from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Script,
  CreateScriptRequest,
  GenerateScriptRequest,
  GenerateScriptQueuedResponse,
  BatchGenerateRequest,
  BatchGenerateResponse,
  UpdateScriptRequest,
  UpdateSceneRequest,
  AddSceneRequest,
  RegenerateSceneRequest,
  ScriptListQuery,
  Scene,
} from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/scripts';

export const scriptsApi = {
  create: async (data: CreateScriptRequest) =>
    unwrapResponse<Script>(await client.post<unknown, Script | ApiResponse<Script>>(BASE, data)),
  generate: async (data: GenerateScriptRequest) =>
    unwrapResponse<GenerateScriptQueuedResponse>(
      await client.post<unknown, GenerateScriptQueuedResponse | ApiResponse<GenerateScriptQueuedResponse>>(`${BASE}/generate`, data),
    ),
  batchGenerate: (data: BatchGenerateRequest) => client.post<unknown, BatchGenerateResponse>(`${BASE}/generate/batch`, data),
  list: async (params?: ScriptListQuery) =>
    unwrapResponse<PaginatedResponse<Script>['data'] | PaginatedResponse<Script>>(
      await client.get<unknown, PaginatedResponse<Script> | ApiResponse<PaginatedResponse<Script>['data']>>(BASE, { params }),
    ),
  detail: async (id: string) => unwrapResponse<Script>(await client.get<unknown, Script | ApiResponse<Script>>(`${BASE}/${id}`)),
  update: async (id: string, data: UpdateScriptRequest) =>
    unwrapResponse<Script>(await client.put<unknown, Script | ApiResponse<Script>>(`${BASE}/${id}`, data)),
  updateScene: async (id: string, sceneId: string, data: UpdateSceneRequest) =>
    unwrapResponse<Scene>(await client.put<unknown, Scene | ApiResponse<Scene>>(`${BASE}/${id}/scenes/${sceneId}`, data)),
  addScene: async (id: string, data: AddSceneRequest) =>
    unwrapResponse<Scene>(await client.post<unknown, Scene | ApiResponse<Scene>>(`${BASE}/${id}/scenes`, data)),
  removeScene: (id: string, sceneId: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}/scenes/${sceneId}`),
  reorderScenes: async (id: string, sceneIds: string[]) =>
    unwrapResponse<Scene[]>(await client.put<unknown, Scene[] | ApiResponse<Scene[]>>(`${BASE}/${id}/scenes/reorder`, { scene_ids: sceneIds })),
  regenerateScene: async (id: string, sceneId: string, data: RegenerateSceneRequest) =>
    unwrapResponse<Scene>(
      await client.post<unknown, Scene | ApiResponse<Scene>>(`${BASE}/${id}/scenes/${sceneId}/regenerate`, data),
    ),
  confirm: async (id: string) => unwrapResponse<Script>(await client.post<unknown, Script | ApiResponse<Script>>(`${BASE}/${id}/confirm`)),
  retry: async (id: string) =>
    unwrapResponse<{ task_id: string; status: 'queued' }>(
      await client.post<unknown, { task_id: string; status: 'queued' } | ApiResponse<{ task_id: string; status: 'queued' }>>(
        `${BASE}/${id}/retry`,
      ),
    ),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
};
