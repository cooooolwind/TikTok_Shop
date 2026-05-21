import client from './client';
import type {
  OverviewData,
  AnalyticsQuery,
  TrendsQuery,
  TrendData,
  AttributionData,
  DurationDistribution,
} from '@aigc/shared-types';

const BASE = '/analytics';

export const analyticsApi = {
  overview: (params?: AnalyticsQuery) => client.get<unknown, OverviewData>(`${BASE}/overview`, { params }),
  trends: (params?: TrendsQuery) => client.get<unknown, TrendData[]>(`${BASE}/trends`, { params }),
  attribution: () => client.get<unknown, AttributionData[]>(`${BASE}/attribution`),
  durationDistribution: () => client.get<unknown, DurationDistribution[]>(`${BASE}/duration-distribution`),
};
