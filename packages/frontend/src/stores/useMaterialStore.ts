import { create } from 'zustand';
import type { Material, MaterialDetail, MaterialListQuery } from '@aigc/shared-types';
import { materialsApi } from '../services/materials.api';

interface MaterialState {
  items: Material[];
  total: number;
  loading: boolean;
  selectedMaterial: MaterialDetail | null;
  filters: MaterialListQuery;

  fetchList: (params?: MaterialListQuery) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: MaterialListQuery) => void;
}

export const useMaterialStore = create<MaterialState>((set) => ({
  items: [],
  total: 0,
  loading: false,
  selectedMaterial: null,
  filters: { page: 1, pageSize: 20 },

  fetchList: async (params) => {
    set({ loading: true });
    const res = await materialsApi.list(params);
    set({ items: res.data.items, total: res.data.total, loading: false });
  },

  fetchDetail: async (id) => {
    const detail = await materialsApi.detail(id);
    set({ selectedMaterial: detail });
  },

  remove: async (id) => {
    await materialsApi.remove(id);
    set((s) => ({ items: s.items.filter((m) => m.id !== id) }));
  },

  setFilters: (filters) => set({ filters }),
}));
