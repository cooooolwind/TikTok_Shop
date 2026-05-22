import { create } from 'zustand';
import type { AnalyticsState } from '../types';
import { analyticsApi } from '../services/analytics.api';
import { useUIStore } from './useAppStore';

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  overview: null,
  trends: [],
  attribution: [],
  durationDistribution: [],
  dateRange: { start_date: '', end_date: '' },
  granularity: 'day',
  loading: false,
  overviewLoading: false,
  trendsLoading: false,
  attributionLoading: false,

  setDateRange: (range) => set({ dateRange: range }),

  setGranularity: (g) => set({ granularity: g }),

  fetchOverview: async () => {
    set({ overviewLoading: true });
    try {
      const overview = await analyticsApi.overview(get().dateRange);
      set({ overview, overviewLoading: false });
    } catch {
      set({ overviewLoading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载概览数据失败' });
    }
  },

  fetchTrends: async () => {
    set({ trendsLoading: true });
    try {
      const trends = await analyticsApi.trends({
        ...get().dateRange,
        granularity: get().granularity,
      });
      set({ trends, trendsLoading: false });
    } catch {
      set({ trendsLoading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载趋势数据失败' });
    }
  },

  fetchAttribution: async () => {
    set({ attributionLoading: true });
    try {
      const attribution = await analyticsApi.attribution();
      set({ attribution, attributionLoading: false });
    } catch {
      set({ attributionLoading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载归因数据失败' });
    }
  },

  fetchDurationDistribution: async () => {
    set({ loading: true });
    try {
      const durationDistribution = await analyticsApi.durationDistribution();
      set({ durationDistribution, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载耗时分布失败' });
    }
  },
}));
