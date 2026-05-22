import type { UploadFile } from 'antd/es/upload/interface';

/** 素材上传表单 */
export interface MaterialUploadFormValues {
  file: UploadFile[];
  category: 'product' | 'scene' | 'model' | 'other';
  source_declaration: 'owned' | 'public_commercial' | 'reference';
  tags: string[];
}

/** 剧本生成表单 */
export interface ScriptGenerateFormValues {
  // 商品信息
  product_name: string;
  product_description: string;
  product_category: string;
  selling_points: string[];
  target_audience?: string;
  price?: string;
  product_images?: UploadFile[];
  product_link?: string;

  // 生成模式
  mode: 'template' | 'imitation' | 'free';
  template_id?: string;
  reference_id?: string;

  // 偏好
  duration: number;
  style?: string;
  tone?: string;
  language?: string;
}

/** 创作任务创建表单 */
export interface CreateTaskFormValues {
  script_id: string;
  resolution: '1080x1920' | '1920x1080' | '1080x1080';
  tts_voice?: string;
  tts_speed?: number;
  bgm_id?: string;
  bgm_volume?: number;
  subtitle_style?: string;
}

/** 参考视频录入表单 */
export interface ReferenceFormValues {
  source_url: string;
  source_platform: string;
  category: string;
  source_declaration: string;
}

/** 灵感模板编辑表单 */
export interface TemplateFormValues {
  name: string;
  strategy: string;
  factors: Record<string, string>;
  constraints: string[];
  applicable_categories: string[];
  derived_from?: string[];
}
