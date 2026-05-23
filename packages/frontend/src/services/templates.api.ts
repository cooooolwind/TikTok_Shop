import client from './client';
import type { ApiResponse, PaginatedResponse, Template, CreateTemplateRequest, UpdateTemplateRequest, TemplateListQuery } from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/templates';

export const templatesApi = {
  create: async (data: CreateTemplateRequest) =>
    unwrapResponse<Template>(await client.post<unknown, Template | ApiResponse<Template>>(BASE, data)),
  list: async (params?: TemplateListQuery) =>
    unwrapResponse<PaginatedResponse<Template>['data'] | PaginatedResponse<Template>>(
      await client.get<unknown, PaginatedResponse<Template> | ApiResponse<PaginatedResponse<Template>['data']>>(BASE, { params }),
    ),
  detail: async (id: string) => unwrapResponse<Template>(await client.get<unknown, Template | ApiResponse<Template>>(`${BASE}/${id}`)),
  update: async (id: string, data: UpdateTemplateRequest) =>
    unwrapResponse<Template>(await client.put<unknown, Template | ApiResponse<Template>>(`${BASE}/${id}`, data)),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
};
