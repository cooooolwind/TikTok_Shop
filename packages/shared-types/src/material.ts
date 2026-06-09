import type { PaginationQuery } from './common';

// ===== 枚举类型 =====

export type MaterialType = 'image' | 'video';
export type BaseMaterialCategory = 'product' | 'scene' | 'model' | 'other';
export type ReferenceMaterialCategory = 'beauty' | 'apparel' | '3c' | 'other';
export type MaterialCategory = BaseMaterialCategory | ReferenceMaterialCategory;
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

export interface StoryboardItem {
  order: number;
  duration: number;
  description: string;
  camera_motion: string;
  visual_elements: string[];
}

export interface ReferenceAnalysis {
  hook: string;
  selling_points: string[];
  style: string;
  duration: number;
  storyboard: StoryboardItem[];
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
  source_platform?: string;
  ai_tags: string[];
  ai_description: string;
  has_embedding: boolean;
  reference_analysis?: ReferenceAnalysis;
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

export type SimilarSearchMode = 'semantic' | 'text';

export interface SimilarSearchRequest {
  query: string;
  type?: MaterialType;
  limit?: number;
  threshold?: number;
  mode?: SimilarSearchMode;
}

export interface SimilarSearchResult {
  material: Material;
  score: number;
}

export interface EmbeddingBackfillRequest {
  materialIds?: string[];
  all?: boolean;
}

export interface EmbeddingBackfillResponse {
  processed: number;
  failed: number;
  errors: string[];
}

export interface MaterialListQuery extends PaginationQuery {
  type?: MaterialType;
  category?: string;
  tags?: string[];
  keyword?: string;
  status?: MaterialStatus;
  source_declaration?: SourceDeclaration | string;
  exclude_source_declaration?: SourceDeclaration | string;
}
