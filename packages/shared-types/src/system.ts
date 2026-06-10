// ===== 健康检查 =====

export interface ServiceStatus {
  database: string;
  redis: string;
  volcano_api: string;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  services: ServiceStatus;
}

// ===== 文件上传 =====

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
}

// ===== 系统设置 =====

export interface AiSettingsDto {
  volcano_api_key?: string;
  volcano_text_api_key?: string;
  volcano_text_endpoint?: string;
  volcano_image_api_key?: string;
  volcano_image_endpoint?: string;
  volcano_video_api_key?: string;
  volcano_video_endpoint?: string;
  volcano_embedding_api_key?: string;
  volcano_embedding_endpoint?: string;
}

export type SetTempApiKeyDto = AiSettingsDto;

export interface TempApiKeyResponse {
  has_temp_settings: boolean;
  settings: AiSettingsDto;
}
