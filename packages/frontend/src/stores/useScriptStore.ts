import { create } from 'zustand';
import type { Scene, ScriptListQuery, ScriptPreferences, ProductInfo, ScriptMode } from '@aigc/shared-types';
import type { ScriptState } from '../types';
import { scriptsApi } from '../services/scripts.api';
import { useUIStore } from './useAppStore';
import { asArray } from '../services/response';

export const useScriptStore = create<ScriptState>((set, get) => ({
  items: [],
  total: 0,
  loading: false,
  filters: { page: 1, pageSize: 20 },
  currentScript: null,
  isDirty: false,
  generating: false,

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const merged = { ...get().filters, ...params };
      const res = await scriptsApi.list(merged);
      const data = 'items' in res ? res : res.data;
      set({ items: asArray(data.items), total: data.total ?? 0, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载剧本列表失败' });
    }
  },

  fetchDetail: async (id) => {
    try {
      const script = await scriptsApi.detail(id);
      set({ currentScript: script, isDirty: false });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '加载剧本详情失败' });
    }
  },

  generate: async (params) => {
    set({ generating: true });
    try {
      const script = await scriptsApi.generate(params);
      set({ generating: false });
      useUIStore.getState().pushNotification({ type: 'success', title: '剧本生成成功' });
      return script;
    } catch {
      set({ generating: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '剧本生成失败' });
      throw new Error('generate failed');
    }
  },

  batchGenerate: async (params) => {
    set({ generating: true });
    try {
      const result = await scriptsApi.batchGenerate(params);
      set({ generating: false });
      useUIStore.getState().pushNotification({ type: 'success', title: `批量生成已提交 (${result.count} 个)` });
      return result;
    } catch {
      set({ generating: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '批量生成失败' });
      throw new Error('batch generate failed');
    }
  },

  updateScript: async (id, data) => {
    try {
      const updated = await scriptsApi.update(id, data);
      set((s) => ({
        currentScript: s.currentScript?.id === id ? updated : s.currentScript,
        items: s.items.map((sc) => (sc.id === id ? updated : sc)),
      }));
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '更新剧本失败' });
    }
  },

  confirm: async (id) => {
    try {
      const updated = await scriptsApi.confirm(id);
      set((s) => ({
        currentScript: s.currentScript?.id === id ? updated : s.currentScript,
        items: s.items.map((sc) => (sc.id === id ? updated : sc)),
      }));
      useUIStore.getState().pushNotification({ type: 'success', title: '剧本已确认' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '确认剧本失败' });
    }
  },

  remove: async (id) => {
    try {
      await scriptsApi.remove(id);
      set((s) => ({ items: s.items.filter((sc) => sc.id !== id), total: s.total - 1 }));
      useUIStore.getState().pushNotification({ type: 'success', title: '剧本已删除' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '删除剧本失败' });
    }
  },

  // 分镜操作 — 乐观更新 + 脏标记
  updateScene: (scriptId, sceneId, data) => {
    set((s) => {
      if (!s.currentScript || s.currentScript.id !== scriptId) return s;
      return {
        currentScript: {
          ...s.currentScript,
          scenes: s.currentScript.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...data } : sc)),
        },
        isDirty: true,
      };
    });
    // 后台异步持久化
    scriptsApi.updateScene(scriptId, sceneId, data).catch(() => {
      useUIStore.getState().pushNotification({ type: 'error', title: '保存分镜失败' });
    });
  },

  addScene: async (scriptId, afterOrder, scene) => {
    try {
      const added = await scriptsApi.addScene(scriptId, { after_order: afterOrder, scene });
      set((s) => {
        if (!s.currentScript || s.currentScript.id !== scriptId) return s;
        const scenes = [...s.currentScript.scenes];
        const insertAt = afterOrder === 0 ? 0 : scenes.findIndex((sc) => sc.order === afterOrder) + 1;
        scenes.splice(insertAt, 0, { ...added, order: afterOrder + 1 });
        // 重新编 order
        const reordered = scenes.map((sc, i) => ({ ...sc, order: i + 1 }));
        return { currentScript: { ...s.currentScript, scenes: reordered }, isDirty: false };
      });
      useUIStore.getState().pushNotification({ type: 'success', title: '分镜已添加' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '添加分镜失败' });
    }
  },

  removeScene: (scriptId, sceneId) => {
    set((s) => {
      if (!s.currentScript || s.currentScript.id !== scriptId) return s;
      const filtered = s.currentScript.scenes.filter((sc) => sc.id !== sceneId);
      return {
        currentScript: { ...s.currentScript, scenes: filtered.map((sc, i) => ({ ...sc, order: i + 1 })) },
        isDirty: true,
      };
    });
    scriptsApi.removeScene(scriptId, sceneId).catch(() => {
      useUIStore.getState().pushNotification({ type: 'error', title: '删除分镜失败' });
    });
  },

  reorderScenes: async (scriptId, sceneIds) => {
    try {
      const reordered = await scriptsApi.reorderScenes(scriptId, sceneIds);
      set((s) => {
        if (!s.currentScript || s.currentScript.id !== scriptId) return s;
        return { currentScript: { ...s.currentScript, scenes: reordered }, isDirty: false };
      });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '排序失败' });
    }
  },

  regenerateScene: async (scriptId, sceneId, target, instruction) => {
    try {
      const regenerated = await scriptsApi.regenerateScene(scriptId, sceneId, { target, instruction });
      set((s) => {
        if (!s.currentScript || s.currentScript.id !== scriptId) return s;
        return {
          currentScript: {
            ...s.currentScript,
            scenes: s.currentScript.scenes.map((sc) => (sc.id === sceneId ? regenerated : sc)),
          },
          isDirty: false,
        };
      });
      useUIStore.getState().pushNotification({ type: 'success', title: '分镜已重新生成' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '重新生成失败' });
    }
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  resetCurrentScript: () => set({ currentScript: null, isDirty: false }),
}));
