import { create } from 'zustand';
import type { BGMState } from '../types';
import { bgmApi } from '../services/bgm.api';
import { useUIStore } from './useAppStore';
import { asArray } from '../services/response';

export const useBGMStore = create<BGMState>((set, get) => ({
  items: [],
  loading: false,
  filters: {},

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const merged = { ...get().filters, ...params };
      const items = await bgmApi.list(merged);
      set({ items: asArray(items), loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载 BGM 列表失败' });
    }
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
