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
