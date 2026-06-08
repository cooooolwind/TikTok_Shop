export type TransitionType = 'none' | 'fade' | 'slide' | 'wipe' | 'zoom_blur';

export interface TransitionConfig {
  type: TransitionType;
  duration_frames?: number;
}

export interface RenderSegment {
  index: number;
  video_url: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  trim_start_seconds?: number;
  trim_end_seconds?: number;
}

export interface SubtitleCue {
  id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
}

export interface RenderInput {
  task_id: string;
  resolution: string;
  fps: number;
  transition: TransitionConfig;
  segments: RenderSegment[];
  transitions?: TransitionConfig[];
  subtitles?: SubtitleCue[];
}
