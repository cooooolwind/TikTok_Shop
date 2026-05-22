/**
 * 业务枚举 → UI 标签映射
 * 所有列表/筛选/状态标签统一从此处取 label，确保全局一致
 */

export const MATERIAL_STATUS_LABELS: Record<string, string> = {
  uploaded: '已上传',
  processing: '分析中',
  ready: '就绪',
  failed: '失败',
};

export const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  product: '商品',
  scene: '场景',
  model: '模特',
  other: '其他',
};

export const SOURCE_DECLARATION_LABELS: Record<string, string> = {
  owned: '自有素材',
  public_commercial: '公开可商用',
  reference: '参考素材',
};

export const SCRIPT_MODE_LABELS: Record<string, string> = {
  template: '灵感模板',
  imitation: '爆款仿写',
  free: '自由创作',
};

export const SCRIPT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  processing: '生成中',
  done: '已完成',
  failed: '失败',
};

export const ANALYSIS_STATUS_LABELS: Record<string, string> = {
  pending: '待分析',
  analyzing: '分析中',
  done: '已完成',
  failed: '失败',
};

/** 状态对应的 Ant Design Tag 颜色 */
export const STATUS_COLOR_MAP: Record<string, string> = {
  uploaded: 'default',
  processing: 'processing',
  ready: 'success',
  failed: 'error',
  draft: 'warning',
  confirmed: 'success',
  queued: 'default',
  done: 'success',
  pending: 'default',
  analyzing: 'processing',
};
