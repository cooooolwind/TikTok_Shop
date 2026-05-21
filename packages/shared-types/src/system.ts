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
