import client from './client';
import type { PaginatedResponse, Template, CreateTemplateRequest, UpdateTemplateRequest, TemplateListQuery } from '@aigc/shared-types';

const BASE = '/templates';

export const templatesApi = {
  create: (data: CreateTemplateRequest) => client.post<unknown, Template>(BASE, data),
  list: (params?: TemplateListQuery) => client.get<unknown, PaginatedResponse<Template>>(BASE, { params }),
  detail: (id: string) => client.get<unknown, Template>(`${BASE}/${id}`),
  update: (id: string, data: UpdateTemplateRequest) => client.put<unknown, Template>(`${BASE}/${id}`, data),
  remove: (id: string) => client.delete<unknown, { message: string }>(`${BASE}/${id}`),
};
