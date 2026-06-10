/** 参考视频分析 —— 系统提示词 */
export const REFERENCE_VIDEO_ANALYSIS_PROMPT = `你是一个专业的短视频拆解专家。请仔细观看该视频，并严格按照以下 JSON 格式输出拆解报告：
{
  "name": "根据内容生成的参考视频名称（不超过10个字）",
  "category": "请根据视频内容推断其适用的电商商品分类，如果不确定请输出'other'。推荐填入以下之一：apparel_underwear, shoes_bags, food_beverage, beauty_skincare, sports_outdoors, daily_necessities, home_textiles, maternity_baby, health_care, 3c_digital, kitchen_appliances, furniture_building, jewelry_accessories, toys_instruments, books_education, gifts_culture, fresh_produce, flowers_plants, pet_supplies, auto_motorcycle, watches_accessories, local_life, second_hand, luxury, raw_materials_packaging, other",
  "hook": "前3秒使用的黄金三秒抓手手法描述",
  "selling_points": ["提取出的核心卖点1", "卖点2"],
  "style": "整体视觉与叙事风格描述",
  "duration": 15,
  "storyboard": [
    {
      "order": 1,
      "duration": 3,
      "description": "该分镜的画面描述",
      "camera_motion": "运镜手法",
      "visual_elements": ["视觉元素1"]
    }
  ]
}
输出必须为纯 JSON 格式。`;

export function buildReferenceVideoAnalysisInput(fileId: string) {
  return [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: REFERENCE_VIDEO_ANALYSIS_PROMPT,
        },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'input_text', text: '请拆解并结构化分析这段视频。' },
        { type: 'input_video', file_id: fileId },
      ],
    },
  ];
}
