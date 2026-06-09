/** 素材图片分析 —— 系统提示词 */
export const IMAGE_ANALYSIS_PROMPT = `你是一位抖音小店内容分析专家。
分析图片并返回 JSON 对象，包含：
1. "tags"：5-8 个描述性标签。
2. "description"：简洁的一句话摘要。
输出必须为 JSON 格式。`;

/** 素材视频分析与切片 —— 系统提示词 */
export const VIDEO_MATERIAL_ANALYSIS_PROMPT = `你是一位抖音小店视频分析与场景分割专家。
分析视频并返回 JSON 对象，包含：
1. "tags"：5-8 个视频整体标签。
2. "description"：视频内容的简洁摘要。
3. "slices"：场景对象数组，每个包含：
   - "start_time"：开始时间（秒，浮点数）。
   - "end_time"：结束时间（秒，浮点数）。
   - "description"：该场景的内容描述。
   - "tags"：3-5 个该场景的专属标签。
将视频分割为适合电商复用的自然高价值场景。输出必须为 JSON 格式。`;

export function buildImageAnalysisMessages(base64Data: string) {
  return [
    {
      role: 'system',
      content: IMAGE_ANALYSIS_PROMPT,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这张电商素材图片。' },
        { type: 'image_url', image_url: { url: base64Data } },
      ],
    },
  ];
}

export function buildVideoAnalysisInput(fileId: string) {
  return [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: VIDEO_MATERIAL_ANALYSIS_PROMPT,
        },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'input_text', text: '请分析并分割这段视频。' },
        { type: 'input_video', file_id: fileId },
      ],
    },
  ];
}
