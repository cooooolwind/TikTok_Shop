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

export const REFERENCE_CATEGORY_LABELS: Record<string, string> = {
  apparel_underwear: '服饰内衣',
  shoes_bags: '鞋靴箱包',
  food_beverage: '食品饮料',
  beauty_skincare: '美妆护肤',
  sports_outdoors: '运动户外',
  daily_necessities: '日用百货',
  home_textiles: '家居家纺',
  maternity_baby: '母婴用品',
  health_care: '医药保健',
  '3c_digital': '3C数码',
  kitchen_appliances: '厨卫家电',
  furniture_building: '家具建材',
  jewelry_accessories: '珠宝饰品',
  toys_instruments: '玩具乐器',
  books_education: '图书教育',
  gifts_culture: '礼品文创',
  fresh_produce: '生鲜蔬果',
  flowers_plants: '鲜花绿植',
  pet_supplies: '宠物用品',
  auto_motorcycle: '汽配摩托',
  watches_accessories: '钟表配饰',
  local_life: '本地生活',
  second_hand: '二手商品',
  luxury: '奢侈品',
  raw_materials_packaging: '原料包装',
  other: '其他',
};

export const SOURCE_DECLARATION_LABELS: Record<string, string> = {
  owned: '自有素材',
  public_commercial: '公开可商用',
  reference: '参考素材',
};

export const REFERENCE_PLATFORM_LABELS: Record<string, string> = {
  local_upload: '本地上传',
  tiktok: 'TikTok',
  douyin: '抖音',
  youtube: 'YouTube',
  instagram: 'Instagram',
};

export const REFERENCE_DECLARATION_LABELS: Record<string, string> = {
  owned_reference: '自有视频',
  public_reference: '公开视频',
};

export const SCRIPT_MODE_LABELS: Record<string, string> = {
  template: '模板生成',
  imitation: '素材生成',
  free: '自由创作',
};

export const SCRIPT_STATUS_LABELS: Record<string, string> = {
  generating: '生成中',
  draft: '草稿',
  failed: '生成失败',
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

export const STATUS_COLOR_MAP: Record<string, string> = {
  uploaded: 'default',
  processing: 'processing',
  ready: 'success',
  failed: 'error',
  generating: 'processing',
  draft: 'warning',
  confirmed: 'success',
  queued: 'default',
  done: 'success',
  pending: 'default',
  analyzing: 'processing',
};
