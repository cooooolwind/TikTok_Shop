// ===== 查询参数 =====

export interface AnalyticsQuery {
  start_date: string;
  end_date: string;
}

export interface TrendsQuery extends AnalyticsQuery {
  granularity: 'day' | 'week' | 'month';
}

// ===== 概览数据 =====

export interface PeriodComparison {
  generated_change: number;
  success_rate_change: number;
}

export interface OverviewData {
  total_generated: number;
  success_rate: number;
  avg_generation_time: number;
  total_materials: number;
  total_scripts: number;
  period_comparison: PeriodComparison;
}

// ===== 趋势数据 =====

export interface TrendData {
  date: string;
  generated_count: number;
  success_count: number;
  failed_count: number;
  avg_duration: number;
}

// ===== 归因数据 =====

export interface AttributionData {
  factor: string;
  value: string;
  usage_count: number;
  avg_performance_score: number;
  conversion_rate?: number;
}

// ===== 时长分布 =====

export interface DurationDistribution {
  range: string;
  count: number;
  percentage: number;
}

// ===== 成本分析 =====

export interface CostOverview {
  total_cost: number;
  avg_cost_per_video: number;
  daily_avg_cost: number;
  period_comparison: { cost_change: number; avg_cost_change: number };
}

export interface CostTrend {
  date: string;
  script_cost: number;
  first_frame_cost: number;
  video_cost: number;
  embedding_cost?: number;
  total_cost: number;
}

export interface CostBreakdown {
  model: string;
  usage: string;
  cost: number;
  tokens: number;
  percentage: number;
}

export interface TemplateCostItem {
  template_name: string;
  usage_count: number;
  avg_cost: number;
  success_rate: number;
}

export interface HighCostVideo {
  video_id: string;
  script_name: string;
  total_cost: number;
  duration: number;
  thumbnail_url?: string;
}

// ===== 转化分析 =====

export interface ConversionOverview {
  total_exposure: number;
  ctr: number;
  cvr: number;
  gmv: number;
  roi: number;
  period_comparison: { gmv_change: number; roi_change: number };
}

export interface ConversionTrend {
  date: string;
  exposure: number;
  click: number;
  order: number;
  gmv: number;
}

export interface CategoryConversion {
  category: string;
  video_count: number;
  ctr: number;
  cvr: number;
  gmv: number;
  roi: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
}

export interface DurationCVR {
  range: string;
  video_count: number;
  cvr: number;
}

// ===== 策略洞察 =====

export interface StrategyFactor {
  type: string;
  label: string;
  icon: string;
  ctr: number;
  usage_pct: number;
}

export interface StrategyFormula {
  features: { name: string; score: number; description: string }[];
}

export interface ABComparison {
  version_a_name: string;
  version_b_name: string;
  metrics: { name: string; a: number; b: number; unit: string }[];
}

export interface RhythmCompleteness {
  rhythm: string;
  completion_rate: number;
}

export interface SubtitleStrategy {
  strategy: string;
  cvr: number;
}

export interface CTAPosition {
  position: string;
  ctr: number;
}

export interface BGMEffect {
  style: string;
  completion_rate: number;
}

// ===== Home 页 =====

export interface HomeStats {
  total_videos: number;
  total_materials: number;
  total_scripts: number;
  success_rate: number;
}
