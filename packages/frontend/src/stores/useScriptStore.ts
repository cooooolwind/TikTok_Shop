import { create } from 'zustand';
import type { Script, ScriptListQuery } from '@aigc/shared-types';
import { scriptsApi } from '../services/scripts.api';

interface ScriptState {
  items: Script[];
  total: number;
  loading: boolean;
  currentScript: Script | null;
  filters: ScriptListQuery;

  fetchList: (params?: ScriptListQuery) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  confirm: (id: string) => Promise<void>;
  setFilters: (filters: ScriptListQuery) => void;
}

export const useScriptStore = create<ScriptState>((set) => ({
  items: [],
  total: 0,
  loading: false,
  currentScript: null,
  filters: { page: 1, pageSize: 20 },

  fetchList: async (params) => {
    set({ loading: true });
    const res = await scriptsApi.list(params);
    set({ items: res.data.items, total: res.data.total, loading: false });
  },

  fetchDetail: async (id) => {
    const script = await scriptsApi.detail(id);
    set({ currentScript: script });
  },

  confirm: async (id) => {
    const updated = await scriptsApi.confirm(id);
    set((s) => ({
      currentScript: updated,
      items: s.items.map((sc) => (sc.id === id ? updated : sc)),
    }));
  },

  setFilters: (filters) => set({ filters }),
}));
