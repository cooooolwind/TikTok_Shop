import client from './client';
import type {
  PaginatedResponse,
  Script,
  GenerateScriptRequest,
  BatchGenerateRequest,
  BatchGenerateResponse,
  UpdateScriptRequest,
  UpdateSceneRequest,
  AddSceneRequest,
  RegenerateSceneRequest,
  ScriptListQuery,
  Scene,
} from '@aigc/shared-types';

const BASE = '/scripts';

export const scriptsApi = {
  generate: (data: GenerateScriptRequest) => client.post<unknown, Script>(`${BASE}/generate`, data),
  batchGenerate: (data: BatchGenerateRequest) => client.post<unknown, BatchGenerateResponse>(`${BASE}/generate/batch`, data),
  list: (params?: ScriptListQuery) => client.get<unknown, PaginatedResponse<Script>>(BASE, { params }),
  detail: (id: string) => client.get<unknown, Script>(`${BASE}/${id}`),
  update: (id: string, data: UpdateScriptRequest) => client.put<unknown, Script>(`${BASE}/${id}`, data),
  updateScene: (id: string, sceneId: string, data: UpdateSceneRequest) =>
    client.put<unknown, Scene>(`${BASE}/${id}/scenes/${sceneId}`, data),
  addScene: (id: string, data: AddSceneRequest) => client.post<unknown, Scene>(`${BASE}/${id}/scenes`, data),
  removeScene: (id: string, sceneId: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}/scenes/${sceneId}`),
  reorderScenes: (id: string, sceneIds: string[]) =>
    client.put<unknown, Scene[]>(`${BASE}/${id}/scenes/reorder`, { scene_ids: sceneIds }),
  regenerateScene: (id: string, sceneId: string, data: RegenerateSceneRequest) =>
    client.post<unknown, Scene>(`${BASE}/${id}/scenes/${sceneId}/regenerate`, data),
  confirm: (id: string) => client.post<unknown, Script>(`${BASE}/${id}/confirm`),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
};
