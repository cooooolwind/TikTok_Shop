import type { PaginationQuery } from './common';
import type { ProductInfo } from './script';

// ===== 任务状态 =====

export type GenerationStatus = 'queued' | 'processing' | 'done' | 'failed';

// ===== 选项配置 =====

export interface VideoOptions {
  resolution?: '1080x1920' | '1920x1080' | '1080x1080';
  aspect_ratio?: '9:16' | '16:9' | '1:1';
  tts_voice?: string;
  tts_speed?: number;
  bgm_id?: string;
  bgm_volume?: number;
  subtitle_style?: string;
}

// ===== 任务进度 =====

export interface TaskProgress {
  current_step: number;
  total_steps: number;
  step_name: string;
  percentage: number;
  message: string;
  estimated_remaining: number;
  phase?:
    | 'queued'
    | 'prepare'
    | 'build_segments'
    | 'submit_segment'
    | 'generate_segment'
    | 'retry_segment'
    | 'persist_result'
    | 'done'
    | 'failed';
  phase_label?: string;
  segment_index?: number;
  segment_total?: number;
  elapsed_seconds?: number;
  detail?: string;
}

// ===== 任务结果 =====

export interface TaskResult {
  video_url: string;
  thumbnail_url: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  file_size: number;
  render_engine?: RenderEngine;
  segments?: VideoSegmentResult[];
  continuity_warning?: string;
  stitching_warning?: string;
}

export interface VideoSegmentResult {
  index: number;
  video_url: string;
  thumbnail_url: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  scene_orders: number[];
  input_frame_url?: string;
  continuity_source?:
    | 'generated_first_frame'
    | 'product_image'
    | 'previous_last_frame'
    | 'text_only';
  status?: 'pending' | 'submitted' | 'running' | 'succeeded' | 'failed' | 'skipped';
  provider_task_id?: string;
  error?: TaskError;
  started_at?: string;
  completed_at?: string;
}

// ===== 任务错误 =====

export interface TaskError {
  code: string;
  message: string;
  retryable: boolean;
  category?: 'network' | 'rate_limit' | 'timeout' | 'moderation' | 'provider' | 'export' | 'unknown';
  segment_index?: number;
  user_action?: string;
}

// ===== 生成任务 =====

export interface GenerationTask {
  id: string;
  display_id?: string;
  script_id: string;
  script_display_id?: string;
  status: GenerationStatus;
  progress: TaskProgress;
  result?: TaskResult;
  error?: TaskError;
  retry_count: number;
  created_at: string;
  completed_at?: string;
}

// ===== 请求/响应 DTO =====

export interface CreateVideoRequest {
  script_id: string;
  display_name?: string;
  options?: VideoOptions;
}

export interface QuickGenerateRequest {
  product_info: ProductInfo;
  template_id?: string;
  options?: VideoOptions;
}

export interface RegenerateSceneVideoRequest {
  instruction?: string;
  material_id?: string;
}

export type RenderEngine = 'ffmpeg' | 'remotion';

export type TransitionType = 'none' | 'fade' | 'slide' | 'wipe' | 'zoom_blur';

export interface TransitionConfig {
  type: TransitionType;
  duration_frames?: number;
}

export interface TimelineClip {
  id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
}

export interface TimelineTransition {
  id: string;
  from_clip_id: string;
  to_clip_id: string;
  type: TransitionType;
  duration_frames?: number;
}

export interface SubtitleCue {
  id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
}

export interface SubtitleProject {
  version: 1;
  task_id: string;
  source: 'script' | 'editor';
  cues: SubtitleCue[];
  updated_at?: string;
}

export interface VideoEditProject {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  subtitles?: SubtitleCue[];
}

export interface ExportRequest {
  format: 'mp4' | 'webm';
  resolution: '1080x1920' | '1920x1080' | '720x1280';
  quality: 'high' | 'medium' | 'low';
  render_engine?: RenderEngine;
  transition?: TransitionConfig;
  edit_project?: VideoEditProject;
}

export interface ExportResponse {
  download_url: string;
  expires_at: string;
  source?: 'segment' | 'stitched' | 'remotion';
  segments_count?: number;
}

export interface GenerationListQuery extends PaginationQuery {
  status?: GenerationStatus;
  script_id?: string;
}
