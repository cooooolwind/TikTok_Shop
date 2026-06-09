import type { CreateScriptRequest, GenerateScriptRequest, ScriptStatus } from '@aigc/shared-types';

export type ScriptEntryMode = 'material' | 'template' | 'imitation' | 'manual_text' | 'manual_structured';

export interface ScriptGenerateFormValues {
  entry?: ScriptEntryMode;
  product_name?: string;
  product_description?: string;
  product_category?: string;
  selling_points?: string[];
  target_audience?: string;
  price?: string;
  product_link?: string;
  product_image_url?: string;
  product_image_urls?: string[];
  template_id?: string;
  reference_id?: string;
  material_ids?: string[];
  manual_text?: string;
  duration?: number;
  style?: string;
  tone?: string;
  language?: string;
  dialogue_mode?: 'auto' | 'enabled' | 'disabled';
}

const MAX_SCRIPT_DURATION = 12;

export function buildScriptGeneratePayload(values: ScriptGenerateFormValues): GenerateScriptRequest {
  const entry = values.entry ?? 'material';
  const materialIds = values.material_ids ?? [];
  return {
    product_info: buildProductInfo(values),
    mode: entry === 'template' ? 'template' : entry === 'imitation' ? 'imitation' : 'free',
    template_id: entry === 'template' ? values.template_id : undefined,
    reference_id: entry === 'imitation' ? values.reference_id : undefined,
    material_ids: materialIds.length > 0 ? materialIds : undefined,
    manual_text: entry === 'manual_text' ? values.manual_text : undefined,
    preferences: {
      duration: Math.min(values.duration ?? MAX_SCRIPT_DURATION, MAX_SCRIPT_DURATION),
      style: values.style,
      tone: values.tone,
      language: values.language ?? 'zh',
      dialogue_mode: values.dialogue_mode ?? 'auto',
      dialogue_type: 'mixed',
    },
  };
}

export function buildManualDraftPayload(values: ScriptGenerateFormValues): CreateScriptRequest {
  return {
    product_info: buildProductInfo(values),
    mode: 'free',
    source_material_ids: values.material_ids?.length ? values.material_ids : undefined,
    visual_style: values.style,
    total_duration: values.duration ?? 15,
    scenes: [],
  };
}

export function getScriptStatusView(status: ScriptStatus) {
  const map: Record<ScriptStatus, { label: string; color: string; canRetry: boolean }> = {
    generating: { label: '生成中', color: 'processing', canRetry: false },
    draft: { label: '草稿', color: 'warning', canRetry: false },
    failed: { label: '生成失败', color: 'error', canRetry: true },
    confirmed: { label: '已确认', color: 'success', canRetry: false },
  };
  return map[status];
}

function buildProductInfo(values: ScriptGenerateFormValues) {
  const images = [
    ...(values.product_image_urls ?? []),
    ...(values.product_image_url ? [values.product_image_url] : []),
  ].filter(Boolean);
  return {
    name: values.product_name ?? '',
    description: values.product_description ?? '',
    category: values.product_category ?? '',
    selling_points: values.selling_points ?? [],
    target_audience: values.target_audience,
    price: values.price,
    images: images.length > 0 ? [...new Set(images)] : undefined,
    link: values.product_link,
  };
}
