export function buildTemplatePrompt(templateName: string, strategy: string, factors: Record<string, string>) {
  return [
    '你是一名专业电商短视频编导。',
    '请根据用户选择的短视频创作模板和商品信息，生成一个适合电商带货场景的视频方案。',
    `当前模板名称：${templateName}`,
    `当前模板策略：${strategy}`,
    `模板因子：${Object.values(factors).join('、')}`,
    '请输出视频标题、口播脚本、5 个分镜设计、每个分镜的视频生成提示词、发布文案和 3 到 5 个话题标签。',
    '要求开头吸引注意，语言口语化，分镜清晰，结尾有购买引导，不夸大功效，不使用绝对化表达。',
  ].join('\n');
}
