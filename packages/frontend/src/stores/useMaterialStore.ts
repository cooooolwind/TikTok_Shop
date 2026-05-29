import { create } from 'zustand';
import type { Material, MaterialDetail, MaterialListQuery, MaterialType } from '@aigc/shared-types';
import type { MaterialState } from '../types';
import { materialsApi } from '../services/materials.api';
import { useUIStore } from './useAppStore';

export const useMaterialStore = create<MaterialState>((set, get) => ({
  items: [],
  total: 0,
  loading: false,
  selectedMaterial: null,
  filters: { page: 1, pageSize: 20 },
  uploadVisible: false,
  uploading: false,
  uploadProgress: 0,

  fetchList: async (params, append = false) => {
    set({ loading: true });
    try {
      const merged = { ...get().filters, ...params };
      const res = await materialsApi.list(merged);
      // res 已经是解包后的数据对象 { items, total, ... }
      const data = 'items' in res ? res : (res as any).data;
      set((s) => ({
        items: append ? [...s.items, ...data.items] : data.items,
        total: data.total,
        loading: false,
      }));
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载素材列表失败' });
    }
  },

  fetchDetail: async (id) => {
    try {
      const detail = await materialsApi.detail(id);
      set({ selectedMaterial: detail });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '加载素材详情失败' });
    }
  },

  updateMaterial: async (id, data) => {
    try {
      const updated = await materialsApi.update(id, data);
      set((s) => ({
        selectedMaterial: s.selectedMaterial?.id === id ? { ...s.selectedMaterial, ...updated } : s.selectedMaterial,
        items: s.items.map((m) => (m.id === id ? { ...m, ...updated } : m)),
      }));
      useUIStore.getState().pushNotification({ type: 'success', title: '更新素材成功' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '更新素材失败' });
    }
  },

  upload: async (file, category, sourceDeclaration, tags, name) => {
    set({ uploading: true, uploadProgress: 0 });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (name) formData.append('name', name);
      formData.append('category', category);
      formData.append('source_declaration', sourceDeclaration);
      if (tags?.length) formData.append('tags', tags.join(','));
      await materialsApi.upload(formData);
      set({ uploading: false, uploadVisible: false, uploadProgress: 100 });
      useUIStore.getState().pushNotification({ type: 'success', title: '上传成功', message: file.name });
      get().fetchList();
    } catch {
      set({ uploading: false, uploadProgress: 0 });
      useUIStore.getState().pushNotification({ type: 'error', title: '上传失败' });
    }
  },

  remove: async (id) => {
    try {
      await materialsApi.remove(id);
      set((s) => ({ items: s.items.filter((m) => m.id !== id), total: s.total - 1 }));
      useUIStore.getState().pushNotification({ type: 'success', title: '已删除' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '删除失败' });
    }
  },

  batchRemove: async (ids) => {
    try {
      await materialsApi.batchRemove(ids);
      set((s) => ({
        items: s.items.filter((m) => !ids.includes(m.id)),
        total: s.total - ids.length,
      }));
      useUIStore.getState().pushNotification({ type: 'success', title: `已删除 ${ids.length} 项` });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '批量删除失败' });
    }
  },

  triggerAnalysis: async (id) => {
    try {
      await materialsApi.analyze(id);
      set((s) => ({
        items: s.items.map((m) => (m.id === id ? { ...m, status: 'processing' } : m)),
      }));
      useUIStore.getState().pushNotification({ type: 'info', title: 'AI 分析已触发' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '触发分析失败' });
    }
  },

  similarSearch: async (query, type, limit, threshold) => {
    const results = await materialsApi.searchSimilar({ query, type, limit, threshold });
    return results;
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setUploadVisible: (visible) => set({ uploadVisible: visible }),
  clearSelection: () => set({ selectedMaterial: null }),
}));
