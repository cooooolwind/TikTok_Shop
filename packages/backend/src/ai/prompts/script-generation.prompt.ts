import type { ProductInfo, ScriptMode, ScriptPreferences } from '@aigc/shared-types';

/** 剧本生成 —— 系统提示词 */
export const SCRIPT_GENERATION_PROMPT = [
  '你是一位专注于转化的抖音小店电商短视频导演和带货文案师。',
  '你唯一的目标是生成带货剧本，让观看者明白为什么要现在购买这款产品。',
  '返回严格的 JSON，包含 narrative_framework、visual_style、total_duration 和 scenes[]。',
  '整个剧本时长不得超过12秒。',
  '这不是普通生活类视频：每个分镜必须直接服务于电商带货、产品卖点、购物意图和转化。',
  '剧本结构要求：开头用痛点、反差、利益点或使用场景打造强力3秒钩子；每个分镜至少包含一个具体卖点或产品价值；最后一个分镜以明确CTA收尾，如点击、立即下单、领券、查看商品详情。',
  '每个分镜需要包含 description、camera_motion、duration、dialogue、bgm_style、subtitle、visual_prompt、constraints。',
  '字段规则：description 必须写明卖货目的和可见动作；dialogue 必须像达人或主播带货口吻；subtitle 必须简短且促转化；visual_prompt 必须描述电商素材，如商品特写、上身效果、细节展示、对比展示、包装展示、价格/优惠提示、购物场景等；constraints 必须要求产品可见、可识别、切题、商业安全、不得是无关联剧情。',
  '在对话或字幕中使用产品名。将产品 selling_points 分配到各分镜。根据 target_audience 调整用词和场景。如有价格或优惠信息，用作利益点或CTA提示，不得虚构折扣。',
  '不要生成抽象意境镜头、泛化叙事、无关剧情或没有产品展示的分镜。',
  '如果提供 material_context，必须优先参考素材 AI 分析、ai_tags、ai_description 和视频切片来设计分镜。',
  '视频切片中的起止时间、描述和标签代表可用素材内容；不要凭空生成与素材分析矛盾或素材中不存在的关键画面。',
].join(' ');

export interface ScriptGenerationPromptMedia {
  type: 'image' | 'video';
  filename: string;
  imageUrl?: string;
  url?: string;
  thumbnailUrl?: string;
}

export interface ScriptGenerationPromptInput {
  productInfo: ProductInfo;
  mode: ScriptMode;
  preferences?: ScriptPreferences;
  template?: unknown;
  materialContext?: string;
  materialMedia?: ScriptGenerationPromptMedia[];
  manualText?: string;
}

export function buildScriptGenerationMessages(data: ScriptGenerationPromptInput) {
  return [
    {
      role: 'system',
      content: SCRIPT_GENERATION_PROMPT,
    },
    {
      role: 'user',
      content: buildScriptGenerationUserContent(
        {
          commerce_objective:
            '生成抖音小店带货转化剧本。剧本必须让观看者明白为什么要现在购买这款产品。',
          product_info: data.productInfo,
          mode: data.mode,
          preferences: data.preferences,
          template: data.template,
          material_context: data.materialContext,
          material_media: (data.materialMedia ?? []).map((item) => ({
            type: item.type,
            filename: item.filename,
            url: item.url,
            thumbnail_url: item.thumbnailUrl,
          })),
          manual_text: data.manualText,
        },
        data.materialMedia ?? [],
      ),
    },
  ];
}

export function buildScriptGenerationUserContent(
  payload: Record<string, unknown>,
  materialMedia: ScriptGenerationPromptMedia[],
) {
  const imageItems = materialMedia
    .filter((item) => item.type === 'image' && item.imageUrl)
    .map((item) => ({
      type: 'image_url',
      image_url: { url: item.imageUrl as string },
    }));

  if (imageItems.length === 0) return JSON.stringify(payload);

  return [
    {
      type: 'text',
      text: JSON.stringify(payload),
    },
    ...imageItems,
  ];
}
