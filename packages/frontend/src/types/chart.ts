import type React from 'react';

/** 统计卡片配置 */
export interface StatCardConfig {
  title: string;
  value: number | string;
  suffix?: string;
  change?: number;           // 环比变化百分比
  changePositive?: boolean;  // true = 涨了是好事
  icon?: React.ReactNode;
  loading?: boolean;
}

/** 归因柱状图数据点 */
export interface AttributionBarData {
  factor: string;
  value: string;
  usageCount: number;
  avgScore: number;
}

/** 耗时分布饼图数据点 */
export interface DurationPieData {
  name: string;
  value: number;
}
