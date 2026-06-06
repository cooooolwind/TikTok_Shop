import { create } from 'zustand';
import type { StrategyAnalyticsState } from '../types';
import { analyticsApi } from '../services/analytics.api';
import { useUIStore } from './useAppStore';
import { asArray } from '../services/response';

export const useStrategyAnalyticsStore = create<StrategyAnalyticsState>((set, get) => ({
  factors: [],
  formula: null,
  abComparison: null,
  rhythm: [],
  subtitle: [],
  cta: [],
  bgm: [],
  dateRange: { start_date: '', end_date: '' },
  loading: false,

  setDateRange: (range) => set({ dateRange: range }),

  fetchFactors: async () => {
    try {
      const factors = await analyticsApi.strategyFactors(get().dateRange);
      set({ factors: asArray(factors) });
    } catch {
      // silent
    }
  },

  fetchFormula: async () => {
    try {
      const formula = await analyticsApi.strategyFormula(get().dateRange);
      set({ formula });
    } catch {
      // silent
    }
  },

  fetchABComparison: async () => {
    try {
      const abComparison = await analyticsApi.abComparison(get().dateRange);
      set({ abComparison });
    } catch {
      // silent
    }
  },

  fetchRhythm: async () => {
    try {
      const rhythm = await analyticsApi.rhythm(get().dateRange);
      set({ rhythm: asArray(rhythm) });
    } catch {
      // silent
    }
  },

  fetchSubtitle: async () => {
    try {
      const subtitle = await analyticsApi.subtitle(get().dateRange);
      set({ subtitle: asArray(subtitle) });
    } catch {
      // silent
    }
  },

  fetchCTA: async () => {
    try {
      const cta = await analyticsApi.cta(get().dateRange);
      set({ cta: asArray(cta) });
    } catch {
      // silent
    }
  },

  fetchBGM: async () => {
    try {
      const bgm = await analyticsApi.bgm(get().dateRange);
      set({ bgm: asArray(bgm) });
    } catch {
      // silent
    }
  },

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [factors, formula, abComparison, rhythm, subtitle, cta, bgm] = await Promise.all([
        analyticsApi.strategyFactors(get().dateRange),
        analyticsApi.strategyFormula(get().dateRange),
        analyticsApi.abComparison(get().dateRange),
        analyticsApi.rhythm(get().dateRange),
        analyticsApi.subtitle(get().dateRange),
        analyticsApi.cta(get().dateRange),
        analyticsApi.bgm(get().dateRange),
      ]);
      set({ factors: asArray(factors), formula, abComparison, rhythm: asArray(rhythm), subtitle: asArray(subtitle), cta: asArray(cta), bgm: asArray(bgm), loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载策略数据失败' });
    }
  },
}));
