import type { PaginationQuery } from './common';

// ===== 灵感模板 =====

export interface Template {
  id: string;
  name: string;
  strategy: string;
  factors: Record<string, string>;
  constraints: string[];
  applicable_categories: string[];
  derived_from: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateRequest {
  name: string;
  strategy: string;
  factors: Record<string, string>;
  constraints: string[];
  applicable_categories: string[];
  derived_from?: string[];
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface TemplateListQuery extends PaginationQuery {
  category?: string;
  keyword?: string;
}
