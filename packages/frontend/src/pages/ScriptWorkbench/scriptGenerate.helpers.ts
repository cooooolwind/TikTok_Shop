import type { CreateScriptRequest, GenerateScriptRequest, ScriptStatus } from '@aigc/shared-types';

export type ScriptEntryMode = 'material' | 'template' | 'manual_text' | 'manual_structured';

export interface ScriptGenerateFormValues {
  entry?: ScriptEntryMode;
  product_name?: string;
  product_description?: string;
  product_category?: string;
  selling_points?: string[];
  target_audience?: string;
  price?: string;
  product_link?: string;
  template_id?: string;
  material_ids?: string[];
  manual_text?: string;
  duration?: number;
  style?: string;
  tone?: string;
  language?: string;
}

const MAX_SCRIPT_DURATION = 12;

export function buildScriptGeneratePayload(values: ScriptGenerateFormValues): GenerateScriptRequest {
  const entry = values.entry ?? 'material';
  return {
    product_info: buildProductInfo(values),
    mode: entry === 'template' ? 'template' : entry === 'material' ? 'imitation' : 'free',
    template_id: entry === 'template' ? values.template_id : undefined,
    material_ids: entry === 'material' ? values.material_ids ?? [] : undefined,
    manual_text: entry === 'manual_text' ? values.manual_text : undefined,
    preferences: {
      duration: Math.min(values.duration ?? MAX_SCRIPT_DURATION, MAX_SCRIPT_DURATION),
      style: values.style,
      tone: values.tone,
      language: values.language ?? 'zh',
    },
  };
}

export function buildManualDraftPayload(values: ScriptGenerateFormValues): CreateScriptRequest {
  return {
    product_info: buildProductInfo(values),
    mode: 'free',
    visual_style: values.style,
    total_duration: Math.min(values.duration ?? MAX_SCRIPT_DURATION, MAX_SCRIPT_DURATION),
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
  return {
    name: values.product_name ?? '',
    description: values.product_description ?? '',
    category: values.product_category ?? '',
    selling_points: values.selling_points ?? [],
    target_audience: values.target_audience,
    price: values.price,
    link: values.product_link,
  };
}
