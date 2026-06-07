import { create } from 'zustand';
import type { CostAnalyticsState } from '../types';
import { analyticsApi } from '../services/analytics.api';
import { useUIStore } from './useAppStore';
import { asArray } from '../services/response';

export const useCostAnalyticsStore = create<CostAnalyticsState>((set, get) => ({
  overview: null,
  trends: [],
  breakdown: [],
  templateCost: [],
  highCostVideos: [],
  dateRange: { start_date: '', end_date: '' },
  granularity: 'day',
  loading: false,

  setDateRange: (range) => set({ dateRange: range }),
  setGranularity: (g) => set({ granularity: g }),

  fetchOverview: async () => {
    set({ loading: true });
    try {
      const overview = await analyticsApi.costOverview(get().dateRange);
      set({ overview, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载成本概览失败' });
    }
  },

  fetchTrends: async () => {
    try {
      const trends = await analyticsApi.costTrends({ ...get().dateRange, granularity: get().granularity });
      set({ trends: asArray(trends) });
    } catch {
      // silent
    }
  },

  fetchBreakdown: async () => {
    try {
      const breakdown = await analyticsApi.costBreakdown(get().dateRange);
      set({ breakdown: asArray(breakdown) });
    } catch {
      // silent
    }
  },

  fetchTemplateCost: async () => {
    try {
      const templateCost = await analyticsApi.templateCost(get().dateRange);
      set({ templateCost: asArray(templateCost) });
    } catch {
      // silent
    }
  },

  fetchHighCostVideos: async () => {
    try {
      const highCostVideos = await analyticsApi.highCostVideos(get().dateRange);
      set({ highCostVideos: asArray(highCostVideos) });
    } catch {
      // silent
    }
  },
}));
