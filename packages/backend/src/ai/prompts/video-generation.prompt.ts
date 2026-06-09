type PromptScene = {
  order: number;
  description?: string;
  cameraMotion?: string;
  duration?: number;
  dialogue?: string;
  subtitle?: string;
  visualPrompt?: string;
  constraints?: string[];
};

type PromptScript = {
  productInfo: {
    name?: string;
    description?: string;
    category?: string;
    selling_points?: string[];
  };
  visualStyle?: string;
};

type PromptSegment = {
  duration: number;
  scenes: PromptScene[];
};

export type VideoPromptContinuitySource =
  | 'generated_first_frame'
  | 'product_image'
  | 'previous_last_frame'
  | 'text_only';

export function buildSegmentVideoPrompt(
  script: PromptScript,
  segment: PromptSegment,
  continuitySource: VideoPromptContinuitySource,
) {
  const sortedScenes = [...segment.scenes].sort((a, b) => a.order - b.order);
  const scene = sortedScenes[0];
  const visualAction = scene?.visualPrompt || scene?.description || '清晰展示商品。';
  const continuityInstruction = buildContinuityInstruction(continuitySource);

  return [
    '生成一段抖音小店视频分镜。',
    '',
    '任务：',
    '仅生成当前分镜。不要添加额外的故事节点。',
    '',
    '视觉动作：',
    visualAction,
    '',
    '产品信息：',
    `产品：${script.productInfo.name || '该产品'}`,
    `品类：${script.productInfo.category || '电商产品'}`,
    `卖点：${(script.productInfo.selling_points ?? []).join('、') || '核心产品优势'}`,
    script.productInfo.description ? `描述：${script.productInfo.description}` : '',
    '',
    '连续性：',
    continuityInstruction,
    '保持产品外观、颜色、形状、材质、灯光和商业风格的一致性。',
    '',
    '分镜详情：',
    `镜头：${scene?.cameraMotion || '固定'}`,
    `输出时长：${segment.duration} 秒。`,
    scene?.dialogue ? `口播台词：${scene.dialogue}` : '',
    scene?.dialogue ? '台词仅用于人物口播、声音或节奏参考，不要以文字形式出现在画面里。' : '',
    '字幕和旁白由后期处理，不要在画面中生成任何字幕、标题、促销文字、说明文字或水印。',
    '',
    '约束条件：',
    (scene?.constraints ?? []).join('、') || '保持产品可见且可识别。',
    '保持产品可见、商业安全、适合电商转化。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildContinuityInstruction(continuitySource: VideoPromptContinuitySource) {
  if (continuitySource === 'generated_first_frame') {
    return '使用提供的 Seedream 生成首帧作为当前分镜的视觉起始点。';
  }
  if (continuitySource === 'previous_last_frame') {
    return '使用上一段视频的最后一帧作为起始画面。仅执行当前分镜的动作。';
  }
  if (continuitySource === 'product_image') {
    return '使用提供的产品图片作为首帧视觉锚点。';
  }
  return '没有可用的图片输入。根据当前分镜提示词和产品信息生成画面。';
}

export function buildFirstFramePrompt(script: PromptScript, segment: PromptSegment) {
  const scene = [...segment.scenes].sort((a, b) => a.order - b.order)[0];
  const action = scene?.visualPrompt || scene?.description || '产品主视觉';

  return [
    '为抖音小店生成一张电商视频首帧画面。',
    `产品：${script.productInfo.name || '该产品'}。`,
    `品类：${script.productInfo.category || '电商产品'}。`,
    `卖点：${(script.productInfo.selling_points ?? []).join('、') || '核心产品优势'}。`,
    script.productInfo.description ? `描述：${script.productInfo.description}。` : '',
    `分镜视觉动作：${action}。`,
    `镜头方向：${scene?.cameraMotion || '固定产品镜头'}。`,
    `商业风格：${script.visualStyle || '简洁、转化导向的产品展示'}。`,
    '参考图中的产品必须清晰可见、可识别，在形状、颜色、材质和包装上忠实还原。',
    '不要在画面中生成字幕、标题、促销文字、说明文字、水印或乱码文字。',
    '不要用其他物品替换产品。不要创建抽象或无关的生活场景。',
    (scene?.constraints ?? []).join('、'),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildFirstFrameRetryPrompt(script: PromptScript, segment: PromptSegment) {
  const scene = [...segment.scenes].sort((a, b) => a.order - b.order)[0];
  const action = scene?.visualPrompt || scene?.description || '简洁产品首帧';

  return [
    '根据参考产品图生成一张简洁的电商视频首帧。',
    `产品：${script.productInfo.name || '该产品'}。`,
    `分镜：${action}。`,
    '保持参考产品清晰可见，忠实地还原其真实形状、颜色、材质、logo和包装。',
    '不要在画面中生成字幕、标题、促销文字、说明文字、水印或乱码文字。',
    '使用简洁的商业产品展示构图，不加任何可能改变产品身份的额外元素。',
  ].join('\n');
}
