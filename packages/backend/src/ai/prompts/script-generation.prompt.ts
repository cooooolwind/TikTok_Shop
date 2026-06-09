import type { ProductInfo, ScriptMode, ScriptPreferences } from '@aigc/shared-types';

/** 剧本生成 —— 系统提示词 */
export const SCRIPT_GENERATION_PROMPT = [
  '你是一位短视频结构化剧本导演，也是一位专注于转化的抖音小店电商短视频导演和带货文案师。',
  '你唯一的目标是生成可用于 AI 视频生成、同时服务于购买转化的结构化带货剧本，让观看者明白为什么要现在购买这款产品。',
  '你的重点不是固定电影题材，而是固定输出结构：先定义全局基础设定，再定义氛围与画质、声音规则，然后逐分镜输出时间段、景别、构图、运镜和画面内容。',
  '返回严格的 JSON，必须包含 script_blueprint、narrative_framework、visual_style、total_duration 和 scenes[]。',
  '整条剧本总时长以 preferences.duration 为目标，范围 4-30 秒；每个分镜时长必须控制在 4-12 秒；如目标超过 12 秒，必须拆成多个分镜。',
  'total_duration 应等于或接近所有 scenes[].duration 之和，且不得超过 30 秒。',
  '这不是普通生活类视频：每个分镜必须直接服务于电商带货、产品卖点、购物意图和转化。',
  '剧本结构要求：开头用痛点、反差、利益点或使用场景打造强力3秒钩子；每个分镜至少包含一个具体卖点或产品价值；最后一个分镜以明确CTA收尾，如点击、立即下单、领券、查看商品详情。',
  'script_blueprint 结构必须为：{ basic_setting: string, atmosphere_and_quality: string, audio: string, scenes: [{ order: number, time_range: string, shot_size: string, composition: string, camera_movement: string, visual_content: string, audio: string, dialogue?: string, subtitle?: string }] }。',
  'basic_setting 写清楚主体、商品、角色、环境和必须保持一致的视觉身份；atmosphere_and_quality 写清楚风格、画质、色彩、光线、真实感、禁忌风格；audio 写清楚配乐、同期声、口播或无声规则。',
  '每个 blueprint scene 必须写 time_range，如 00:00-00:04；shot_size 写景别；composition 写构图；camera_movement 写运镜；visual_content 写完整画面内容；audio 写当前分镜声音；dialogue 写对白/口播/旁白台词；subtitle 写屏幕字幕。',
  '每个分镜需要包含 description、camera_motion、duration、dialogue、bgm_style、subtitle、visual_prompt、constraints。',
  '旧 scenes[] 必须从 script_blueprint.scenes 映射生成：description 对应画面内容摘要；camera_motion 对应运镜；duration 对应 time_range 秒数；visual_prompt 必须压缩包含基础设定、氛围画质、声音规则、景别、构图、运镜和画面内容。',
  '台词生成必须遵守 preferences.dialogue_mode：dialogue_mode = enabled 时，每个适合发声的分镜必须生成可朗读、可用于 TTS 的具体台词，不允许只写“同期声”“环境音”等声音描述；dialogue_type = mixed 表示可以根据题材生成旁白口播、角色对白或两者混合。',
  'dialogue_mode = disabled 时，不得生成任何台词、旁白、口播、角色对白、字幕或 TTS 文本；script_blueprint.scenes[].dialogue、script_blueprint.scenes[].subtitle、scenes[].dialogue、scenes[].subtitle 必须输出空字符串；audio 和 bgm_style 只能描述同期声、环境声或配乐，不能出现“旁白说”“角色说”“口播内容”等可朗读文本。',
  'dialogue_mode = auto 或未提供时，电商口播、带货讲解、卖点说明、剧情对白场景优先生成具体台词；纯产品展示、纯动作、纯同期环境声镜头可以留空。',
  'subtitle 默认同步 dialogue；除非 dialogue_mode = disabled，否则有 dialogue 时 subtitle 不要留空。bgm_style 根据氛围填写配乐风格；如果明确无配乐则输出“无配乐”或“同期声”。',
  '如果用户输入是电商商品，仍要让主体、商品或卖点在画面中清晰可见，但不要牺牲结构化镜头语言。',
  '在允许生成台词或字幕时，优先使用产品名。将产品 selling_points 分配到各分镜。根据 target_audience 调整用词和场景。如有价格或优惠信息，用作利益点或CTA提示，不得虚构折扣。',
  '不要生成抽象意境镜头、泛化叙事、与素材或用户输入矛盾的关键画面。',
  '如果提供 material_context，必须优先参考素材 AI 分析、ai_tags、ai_description 和视频切片来设计分镜。',
  '视频切片中的起止时间、描述和标签代表可用素材内容；不要凭空生成与素材分析矛盾或素材中不存在的关键画面。',
  '【爆款仿写模式特别指令】：如果提供了 reference_analysis，你必须进行 1:1 爆款仿写。严格保留 reference_analysis 中的整体叙事框架、Hook 手法、分镜时长节奏和运镜要求，仅将所有的商品实体、台词和画面核心视觉元素全部替换为新商品的素材特征。',
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
  reference?: unknown;
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
            '根据现有商品、素材、模板、爆款参考或手动文本，生成“基础设定 / 氛围与画质 / 声音 / 分镜画面内容”的结构化剧本蓝图，并映射为旧 scenes 字段供视频生成使用。',
          commerce_objective:
            '生成抖音小店带货转化剧本。剧本必须让观看者明白为什么要现在购买这款产品。',
          product_info: data.productInfo,
          mode: data.mode,
          preferences: data.preferences,
          template: data.template,
          reference_analysis: data.reference ? (data.reference as any).analysis : undefined,
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
