/** 视频分辨率选项 */
export const RESOLUTIONS = [
  { label: '1080x1920 (9:16 竖版)', value: '1080x1920' as const },
  { label: '1920x1080 (16:9 横版)', value: '1920x1080' as const },
  { label: '1080x1080 (1:1 方形)', value: '1080x1080' as const },
];

/** 画幅比例 */
export const ASPECT_RATIOS = ['9:16', '16:9', '1:1'] as const;

/** 导出格式 */
export const EXPORT_FORMATS = [
  { label: 'MP4', value: 'mp4' },
  { label: 'WebM', value: 'webm' },
] as const;

/** 导出画质 */
export const EXPORT_QUALITY = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
] as const;

/** 素材分类 */
export const MATERIAL_CATEGORIES = [
  { label: '商品', value: 'product' },
  { label: '场景', value: 'scene' },
  { label: '模特', value: 'model' },
  { label: '其他', value: 'other' },
] as const;

/** BGM 风格 */
export const BGM_STYLES = [
  { label: '欢快', value: 'upbeat' },
  { label: '平静', value: 'calm' },
  { label: '戏剧', value: 'dramatic' },
  { label: '搞笑', value: 'funny' },
] as const;
