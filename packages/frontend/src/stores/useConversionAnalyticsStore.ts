import { create } from 'zustand';
import type { ConversionAnalyticsState } from '../types';
import { analyticsApi } from '../services/analytics.api';
import { useUIStore } from './useAppStore';
import { asArray } from '../services/response';

export const useConversionAnalyticsStore = create<ConversionAnalyticsState>((set, get) => ({
  overview: null,
  trends: [],
  categoryConversion: [],
  funnel: [],
  durationCVR: [],
  dateRange: { start_date: '', end_date: '' },
  granularity: 'day',
  loading: false,

  setDateRange: (range) => set({ dateRange: range }),
  setGranularity: (g) => set({ granularity: g }),

  fetchOverview: async () => {
    set({ loading: true });
    try {
      const overview = await analyticsApi.conversionOverview(get().dateRange);
      set({ overview, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载转化概览失败' });
    }
  },

  fetchTrends: async () => {
    try {
      const trends = await analyticsApi.conversionTrends({ ...get().dateRange, granularity: get().granularity });
      set({ trends: asArray(trends) });
    } catch {
      // silent
    }
  },

  fetchCategoryConversion: async () => {
    try {
      const categoryConversion = await analyticsApi.categoryConversion(get().dateRange);
      set({ categoryConversion: asArray(categoryConversion) });
    } catch {
      // silent
    }
  },

  fetchFunnel: async () => {
    try {
      const funnel = await analyticsApi.funnel(get().dateRange);
      set({ funnel: asArray(funnel) });
    } catch {
      // silent
    }
  },

  fetchDurationCVR: async () => {
    try {
      const durationCVR = await analyticsApi.durationCVR(get().dateRange);
      set({ durationCVR: asArray(durationCVR) });
    } catch {
      // silent
    }
  },
}));
