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
  prompt?: string;
  status?: 'enabled' | 'disabled';
  is_builtin?: boolean;
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
  prompt?: string;
  status?: 'enabled' | 'disabled';
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface TemplateListQuery extends PaginationQuery {
  category?: string;
  keyword?: string;
  status?: 'enabled' | 'disabled';
}

export interface TemplateGenerateRequest {
  productName: string;
  category: string;
  sellingPoints: string;
  price: string;
  targetUser: string;
  promotion?: string;
  duration: string;
  style: string;
}

export interface TemplateStoryboardShot {
  shot: number;
  content: string;
  videoPrompt: string;
}

export interface TemplateGenerateResult {
  title: string;
  script: string;
  storyboard: TemplateStoryboardShot[];
  publishCopy: string;
  tags: string[];
}

export interface MyVideo {
  id: string;
  product_name: string;
  template_id: string;
  template_name: string;
  status: 'generated' | 'saved';
  result: TemplateGenerateResult;
  product_info: TemplateGenerateRequest;
  created_at: string;
}

export interface SaveMyVideoRequest {
  template_id: string;
  template_name: string;
  product_info: TemplateGenerateRequest;
  result: TemplateGenerateResult;
}
