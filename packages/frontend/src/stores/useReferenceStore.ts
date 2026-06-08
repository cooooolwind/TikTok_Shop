import { create } from 'zustand';
import type { ReferenceState } from '../types';
import { referencesApi } from '../services/references.api';
import { useUIStore } from './useAppStore';

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  items: [],
  total: 0,
  loading: false,
  selectedReference: null,
  filters: { page: 1, pageSize: 20 },

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const merged = { ...get().filters, ...params };
      const res = await referencesApi.list(merged);
      // res 已经是解包后的数据对象 { items, total, ... }
      const data = 'items' in res ? res : (res as any).data;
      set({ items: data.items, total: data.total, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载参考视频失败' });
    }
  },

  fetchDetail: async (id) => {
    try {
      const detail = await referencesApi.detail(id);
      set({ selectedReference: detail });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '加载参考视频详情失败' });
    }
  },

  create: async (data) => {
    try {
      await referencesApi.create(data);
      useUIStore.getState().pushNotification({ type: 'success', title: '参考视频已添加' });
      get().fetchList();
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '添加参考视频失败' });
    }
  },

  upload: async (file, category, sourceDeclaration) => {
    try {
      set({ loading: true });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      formData.append('source_declaration', sourceDeclaration);
      await referencesApi.upload(formData);
      useUIStore.getState().pushNotification({ type: 'success', title: '参考视频已上传并加入分析队列' });
      get().fetchList();
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '上传参考视频失败' });
    } finally {
      set({ loading: false });
    }
  },

  remove: async (id) => {
    try {
      await referencesApi.remove(id);
      set((s) => ({ items: s.items.filter((r) => r.id !== id), total: s.total - 1 }));
      useUIStore.getState().pushNotification({ type: 'success', title: '已删除' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '删除失败' });
    }
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
