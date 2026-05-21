import { create } from 'zustand';
import type { OverviewData, TrendData, AttributionData, DurationDistribution, AnalyticsQuery } from '@aigc/shared-types';

interface AnalyticsState {
  overview: OverviewData | null;
  trends: TrendData[];
  attribution: AttributionData[];
  durationDistribution: DurationDistribution[];
  dateRange: AnalyticsQuery;
  loading: boolean;

  setDateRange: (range: AnalyticsQuery) => void;
  fetchOverview: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>(() => ({
  overview: null,
  trends: [],
  attribution: [],
  durationDistribution: [],
  dateRange: { start_date: '', end_date: '' },
  loading: false,

  setDateRange: (range) => {
    // stub
  },

  fetchOverview: async () => {
    // stub
  },
}));
