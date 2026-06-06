import client from './client';
import { unwrapResponse } from './response';
import type {
  OverviewData,
  AnalyticsQuery,
  TrendsQuery,
  TrendData,
  AttributionData,
  DurationDistribution,
  CostOverview,
  CostTrend,
  CostBreakdown,
  TemplateCostItem,
  HighCostVideo,
  ConversionOverview,
  ConversionTrend,
  CategoryConversion,
  FunnelStage,
  DurationCVR,
  StrategyFactor,
  StrategyFormula,
  ABComparison,
  RhythmCompleteness,
  SubtitleStrategy,
  CTAPosition,
  BGMEffect,
  HomeStats,
} from '@aigc/shared-types';

const BASE = '/analytics';

export const analyticsApi = {
  overview: async (params?: AnalyticsQuery): Promise<OverviewData> =>
    unwrapResponse<OverviewData>((await client.get<unknown, unknown>(`${BASE}/overview`, { params })) as OverviewData),
  trends: async (params?: TrendsQuery): Promise<TrendData[]> =>
    unwrapResponse<TrendData[]>((await client.get<unknown, unknown>(`${BASE}/trends`, { params })) as TrendData[]),
  attribution: async (): Promise<AttributionData[]> =>
    unwrapResponse<AttributionData[]>((await client.get<unknown, unknown>(`${BASE}/attribution`)) as AttributionData[]),
  durationDistribution: async (params?: AnalyticsQuery): Promise<DurationDistribution[]> =>
    unwrapResponse<DurationDistribution[]>((await client.get<unknown, unknown>(`${BASE}/duration-distribution`, { params })) as DurationDistribution[]),
  materialDistribution: async () =>
    unwrapResponse<{
      type_distribution: { type: string; count: number }[];
      category_distribution: { category: string; count: number }[];
      status_distribution: { status: string; count: number }[];
      ai_tag_coverage: number;
    }>((await client.get<unknown, unknown>(`${BASE}/material-distribution`)) as any),

  // ===== cost =====
  costOverview: async (params?: AnalyticsQuery): Promise<CostOverview> =>
    unwrapResponse<CostOverview>((await client.get<unknown, unknown>(`${BASE}/cost/overview`, { params })) as CostOverview),
  costTrends: async (params?: TrendsQuery): Promise<CostTrend[]> =>
    unwrapResponse<CostTrend[]>((await client.get<unknown, unknown>(`${BASE}/cost/trends`, { params })) as CostTrend[]),
  costBreakdown: async (params?: AnalyticsQuery): Promise<CostBreakdown[]> =>
    unwrapResponse<CostBreakdown[]>((await client.get<unknown, unknown>(`${BASE}/cost/breakdown`, { params })) as CostBreakdown[]),
  templateCost: async (params?: AnalyticsQuery): Promise<TemplateCostItem[]> =>
    unwrapResponse<TemplateCostItem[]>((await client.get<unknown, unknown>(`${BASE}/cost/by-template`, { params })) as TemplateCostItem[]),
  highCostVideos: async (params?: AnalyticsQuery): Promise<HighCostVideo[]> =>
    unwrapResponse<HighCostVideo[]>((await client.get<unknown, unknown>(`${BASE}/cost/high-cost-videos`, { params })) as HighCostVideo[]),

  // ===== conversion =====
  conversionOverview: async (params?: AnalyticsQuery): Promise<ConversionOverview> =>
    unwrapResponse<ConversionOverview>((await client.get<unknown, unknown>(`${BASE}/conversion/overview`, { params })) as ConversionOverview),
  conversionTrends: async (params?: TrendsQuery): Promise<ConversionTrend[]> =>
    unwrapResponse<ConversionTrend[]>((await client.get<unknown, unknown>(`${BASE}/conversion/trends`, { params })) as ConversionTrend[]),
  categoryConversion: async (params?: AnalyticsQuery): Promise<CategoryConversion[]> =>
    unwrapResponse<CategoryConversion[]>((await client.get<unknown, unknown>(`${BASE}/conversion/by-category`, { params })) as CategoryConversion[]),
  funnel: async (params?: AnalyticsQuery): Promise<FunnelStage[]> =>
    unwrapResponse<FunnelStage[]>((await client.get<unknown, unknown>(`${BASE}/conversion/funnel`, { params })) as FunnelStage[]),
  durationCVR: async (params?: AnalyticsQuery): Promise<DurationCVR[]> =>
    unwrapResponse<DurationCVR[]>((await client.get<unknown, unknown>(`${BASE}/conversion/duration-cvr`, { params })) as DurationCVR[]),

  // ===== strategy =====
  strategyFactors: async (params?: AnalyticsQuery): Promise<StrategyFactor[]> =>
    unwrapResponse<StrategyFactor[]>((await client.get<unknown, unknown>(`${BASE}/strategy/factors`, { params })) as StrategyFactor[]),
  strategyFormula: async (params?: AnalyticsQuery): Promise<StrategyFormula> =>
    unwrapResponse<StrategyFormula>((await client.get<unknown, unknown>(`${BASE}/strategy/formula`, { params })) as StrategyFormula),
  abComparison: async (params?: AnalyticsQuery): Promise<ABComparison> =>
    unwrapResponse<ABComparison>((await client.get<unknown, unknown>(`${BASE}/strategy/ab-comparison`, { params })) as ABComparison),
  rhythm: async (params?: AnalyticsQuery): Promise<RhythmCompleteness[]> =>
    unwrapResponse<RhythmCompleteness[]>((await client.get<unknown, unknown>(`${BASE}/strategy/rhythm`, { params })) as RhythmCompleteness[]),
  subtitle: async (params?: AnalyticsQuery): Promise<SubtitleStrategy[]> =>
    unwrapResponse<SubtitleStrategy[]>((await client.get<unknown, unknown>(`${BASE}/strategy/subtitle`, { params })) as SubtitleStrategy[]),
  cta: async (params?: AnalyticsQuery): Promise<CTAPosition[]> =>
    unwrapResponse<CTAPosition[]>((await client.get<unknown, unknown>(`${BASE}/strategy/cta`, { params })) as CTAPosition[]),
  bgm: async (params?: AnalyticsQuery): Promise<BGMEffect[]> =>
    unwrapResponse<BGMEffect[]>((await client.get<unknown, unknown>(`${BASE}/strategy/bgm`, { params })) as BGMEffect[]),

  // ===== home =====
  homeStats: async (): Promise<HomeStats> =>
    unwrapResponse<HomeStats>((await client.get<unknown, unknown>(`${BASE}/home-stats`)) as HomeStats),
};
