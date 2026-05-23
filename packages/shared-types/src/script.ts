import type { PaginationQuery } from './common';

// ===== 商品信息 =====

export interface ProductInfo {
  name: string;
  description: string;
  category: string;
  selling_points: string[];
  target_audience?: string;
  price?: string;
  images?: string[];
  link?: string;
}

// ===== 分镜 =====

export interface Scene {
  id: string;
  order: number;
  description: string;
  camera_motion: string;
  duration: number;
  dialogue: string;
  bgm_style: string;
  subtitle: string;
  visual_prompt: string;
  constraints: string[];
}

// ===== 剧本 =====

export type ScriptMode = 'template' | 'imitation' | 'free';
export type ScriptStatus = 'generating' | 'draft' | 'failed' | 'confirmed';

export interface Script {
  id: string;
  product_info: ProductInfo;
  template_id?: string;
  reference_id?: string;
  source_material_ids?: string[];
  generation_task_id?: string;
  generation_error?: string;
  mode: ScriptMode;
  narrative_framework: string;
  visual_style: string;
  total_duration: number;
  scenes: Scene[];
  status: ScriptStatus;
  created_at: string;
  updated_at: string;
}

// ===== 请求/响应 DTO =====

export interface ScriptPreferences {
  duration: number;
  style?: string;
  tone?: string;
  language?: string;
}

export interface GenerateScriptRequest {
  product_info: ProductInfo;
  template_id?: string;
  reference_id?: string;
  material_ids?: string[];
  manual_text?: string;
  mode: ScriptMode;
  preferences?: ScriptPreferences;
}

export interface GenerateScriptQueuedResponse {
  script: Script;
  task_id: string;
  status: 'queued';
}

export interface CreateScriptRequest {
  product_info: ProductInfo;
  mode: ScriptMode;
  template_id?: string;
  reference_id?: string;
  source_material_ids?: string[];
  narrative_framework?: string;
  visual_style?: string;
  total_duration?: number;
  scenes?: Omit<Scene, 'id' | 'order'>[];
}

export interface BatchGenerateRequest {
  product_info: ProductInfo;
  count: number;
  strategy_variations?: string[];
  factor_variations?: Record<string, string[]>;
}

export interface BatchGenerateResponse {
  task_id: string;
  status: 'queued';
  count: number;
}

export interface UpdateScriptRequest {
  narrative_framework?: string;
  visual_style?: string;
  status?: ScriptStatus;
}

export interface UpdateSceneRequest {
  description?: string;
  camera_motion?: string;
  duration?: number;
  dialogue?: string;
  bgm_style?: string;
  subtitle?: string;
  visual_prompt?: string;
  constraints?: string[];
}

export interface AddSceneRequest {
  after_order: number;
  scene: Omit<Scene, 'id' | 'order'>;
}

export interface ReorderScenesRequest {
  scene_ids: string[];
}

export interface RegenerateSceneRequest {
  target: 'dialogue' | 'visual_prompt' | 'all';
  instruction?: string;
}

export interface ScriptListQuery extends PaginationQuery {
  status?: ScriptStatus;
  mode?: ScriptMode;
  keyword?: string;
}
