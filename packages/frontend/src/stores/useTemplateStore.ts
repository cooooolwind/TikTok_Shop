import { create } from 'zustand';
import type { TemplateState } from '../types';
import { templatesApi } from '../services/templates.api';
import { useUIStore } from './useAppStore';

export const useTemplateStore = create<TemplateState>((set, get) => ({
  items: [],
  total: 0,
  loading: false,
  selectedTemplate: null,
  filters: { page: 1, pageSize: 20 },

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const merged = { ...get().filters, ...params };
      const res = await templatesApi.list(merged);
      set({ items: res.data.items, total: res.data.total, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载模板失败' });
    }
  },

  fetchDetail: async (id) => {
    try {
      const detail = await templatesApi.detail(id);
      set({ selectedTemplate: detail });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '加载模板详情失败' });
    }
  },

  create: async (data) => {
    try {
      await templatesApi.create(data);
      useUIStore.getState().pushNotification({ type: 'success', title: '模板已创建' });
      get().fetchList();
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '创建模板失败' });
    }
  },

  update: async (id, data) => {
    try {
      const updated = await templatesApi.update(id, data);
      set((s) => ({
        selectedTemplate: s.selectedTemplate?.id === id ? updated : s.selectedTemplate,
        items: s.items.map((t) => (t.id === id ? updated : t)),
      }));
      useUIStore.getState().pushNotification({ type: 'success', title: '模板已更新' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '更新模板失败' });
    }
  },

  remove: async (id) => {
    try {
      await templatesApi.remove(id);
      set((s) => ({ items: s.items.filter((t) => t.id !== id), total: s.total - 1 }));
      useUIStore.getState().pushNotification({ type: 'success', title: '已删除' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '删除失败' });
    }
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
