import type { PaginationQuery } from './common';

// ===== 枚举类型 =====

export type MaterialType = 'image' | 'video';
export type MaterialCategory = 'product' | 'scene' | 'model' | 'other';
export type MaterialStatus = 'uploaded' | 'processing' | 'ready' | 'failed';
export type SourceDeclaration = 'owned' | 'public_commercial' | 'reference';

// ===== 视频切片 =====

export interface VideoSlice {
  id: string;
  start_time: number;
  end_time: number;
  description: string;
  thumbnail_url: string;
  tags: string[];
}

// ===== 素材 =====

export interface Material {
  id: string;
  type: MaterialType;
  url: string;
  thumbnail_url: string;
  name: string;
  filename: string;
  size: number;
  category: MaterialCategory;
  tags: string[];
  source_declaration: SourceDeclaration;
  ai_tags: string[];
  ai_description: string;
  duration?: number;
  resolution?: { width: number; height: number };
  status: MaterialStatus;
  created_at: string;
  updated_at: string;
}

export interface MaterialMetadata {
  format: string;
  bitrate?: number;
  fps?: number;
  color_profile?: string;
}

export interface MaterialDetail extends Material {
  slices?: VideoSlice[];
  metadata: MaterialMetadata;
}

// ===== 请求/响应 =====

export interface MaterialUploadResponse {
  id: string;
  name: string;
  filename: string;
  type: MaterialType;
  url: string;
  size: number;
  status: 'uploaded' | 'processing';
}

export interface AnalyzeResponse {
  task_id: string;
  status: 'queued';
}

export interface SimilarSearchRequest {
  query: string;
  type?: MaterialType;
  limit?: number;
  threshold?: number;
}

export interface SimilarSearchResult {
  material: Material;
  score: number;
}

export interface MaterialListQuery extends PaginationQuery {
  type?: MaterialType;
  category?: string;
  tags?: string[];
  keyword?: string;
  status?: MaterialStatus;
}
