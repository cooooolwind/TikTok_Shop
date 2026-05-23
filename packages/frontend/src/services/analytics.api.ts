import client from './client';
import type {
  OverviewData,
  AnalyticsQuery,
  TrendsQuery,
  TrendData,
  AttributionData,
  DurationDistribution,
} from '@aigc/shared-types';
import { unwrapResponse } from './response';

const BASE = '/analytics';

export const analyticsApi = {
  overview: async (params?: AnalyticsQuery): Promise<OverviewData> =>
    unwrapResponse<OverviewData>((await client.get<unknown, unknown>(`${BASE}/overview`, { params })) as OverviewData),
  trends: async (params?: TrendsQuery): Promise<TrendData[]> =>
    unwrapResponse<TrendData[]>((await client.get<unknown, unknown>(`${BASE}/trends`, { params })) as TrendData[]),
  attribution: async (): Promise<AttributionData[]> =>
    unwrapResponse<AttributionData[]>((await client.get<unknown, unknown>(`${BASE}/attribution`)) as AttributionData[]),
  durationDistribution: async (): Promise<DurationDistribution[]> =>
    unwrapResponse<DurationDistribution[]>((await client.get<unknown, unknown>(`${BASE}/duration-distribution`)) as DurationDistribution[]),
};
