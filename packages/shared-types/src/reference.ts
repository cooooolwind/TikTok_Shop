import type { PaginationQuery } from './common';

// ===== 结构化拆解 =====

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

// ===== 参考视频 =====

export type AnalysisStatus = 'fetching' | 'uploading' | 'analyzing' | 'done' | 'failed';

export interface ReferenceVideo {
  id: string;
  source_url: string;
  source_platform: string;
  category: string;
  source_declaration: string;
  analysis_status: AnalysisStatus;
  analysis?: ReferenceAnalysis;
  created_at: string;
}

export interface CreateReferenceRequest {
  source_url: string;
  source_platform: string;
  category: string;
  source_declaration: string;
}

export interface ReferenceListQuery extends PaginationQuery {
  category?: string;
  source_platform?: string;
  analysis_status?: AnalysisStatus;
}
