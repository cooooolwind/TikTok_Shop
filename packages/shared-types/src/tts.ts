// ===== 音色 =====

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  language: string;
  style: string;
  preview_url: string;
}

// ===== 请求/响应 =====

export interface TTSPreviewRequest {
  text: string;
  voice_id: string;
  speed?: number;
}

export interface TTSPreviewResponse {
  audio_url: string;
  duration: number;
}
