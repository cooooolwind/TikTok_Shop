import type { ProductInfo, ScriptMode, ScriptPreferences } from '@aigc/shared-types';

/** 剧本生成 —— 系统提示词 */
export const SCRIPT_GENERATION_PROMPT = [
  '你是一位短视频结构化剧本导演，负责把用户现有输入整理成可直接用于 AI 视频生成的分镜蓝图。',
  '你的重点不是固定电影题材，而是固定输出结构：先定义全局基础设定，再定义氛围与画质、声音规则，然后逐分镜输出时间段、景别、构图、运镜和画面内容。',
  '返回严格的 JSON，必须包含 script_blueprint、narrative_framework、visual_style、total_duration 和 scenes[]。',
  '整个剧本时长不得超过12秒。',
  'script_blueprint 结构必须为：{ basic_setting: string, atmosphere_and_quality: string, audio: string, scenes: [{ order: number, time_range: string, shot_size: string, composition: string, camera_movement: string, visual_content: string, audio: string }] }。',
  'basic_setting 写清楚主体、商品、角色、环境和必须保持一致的视觉身份；atmosphere_and_quality 写清楚风格、画质、色彩、光线、真实感、禁忌风格；audio 写清楚配乐、同期声、口播或无声规则。',
  '每个 blueprint scene 必须写 time_range，如 00:00-00:04；shot_size 写景别；composition 写构图；camera_movement 写运镜；visual_content 写完整画面内容；audio 写当前分镜声音。',
  '每个分镜需要包含 description、camera_motion、duration、dialogue、bgm_style、subtitle、visual_prompt、constraints。',
  '旧 scenes[] 必须从 script_blueprint.scenes 映射生成：description 对应画面内容摘要；camera_motion 对应运镜；duration 对应 time_range 秒数；visual_prompt 必须压缩包含基础设定、氛围画质、声音规则、景别、构图、运镜和画面内容。',
  'dialogue、subtitle、bgm_style 保留但允许为空；如果设定要求仅同期声、无配乐、无对白，则 dialogue 和 subtitle 输出空字符串，bgm_style 输出“同期声”或“无配乐”。',
  '如果用户输入是电商商品，仍要让主体、商品或卖点在画面中清晰可见，但不要牺牲结构化镜头语言。',
  '不要生成抽象意境镜头、泛化叙事、与素材或用户输入矛盾的关键画面。',
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
          generation_objective:
            '根据现有商品、素材、模板或手动文本，生成“基础设定 / 氛围与画质 / 声音 / 分镜画面内容”的结构化剧本蓝图，并映射为旧 scenes 字段供视频生成使用。',
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
