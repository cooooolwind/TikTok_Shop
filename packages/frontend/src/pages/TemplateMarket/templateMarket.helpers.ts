import type {
  SaveMyVideoRequest,
  TemplateGenerateRequest,
  TemplateGenerateResult,
} from '@aigc/shared-types';

export const CATEGORY_LABELS: Record<string, string> = {
  fashion: '服装',
  beauty: '美妆',
  home: '家居',
  electronics: '数码',
  food: '食品',
  general: '通用',
};

export function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export function countTemplateFactors(factors?: Record<string, string>) {
  return Object.keys(factors ?? {}).length;
}

export function buildSaveMyVideoPayload(
  templateId: string,
  templateName: string,
  productInfo: TemplateGenerateRequest,
  result: TemplateGenerateResult,
): SaveMyVideoRequest {
  return {
    template_id: templateId,
    template_name: templateName,
    product_info: productInfo,
    result,
  };
}
