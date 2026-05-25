import { create } from 'zustand';
import type { GenerationListQuery, TaskProgress, TaskResult, TaskError } from '@aigc/shared-types';
import type { CreationState } from '../types';
import { generationApi } from '../services/generation.api';
import { unwrapResponse } from '../services/response';
import { useUIStore } from './useAppStore';

export const useCreationStore = create<CreationState>((set, get) => ({
  tasks: [],
  total: 0,
  loading: false,
  filters: { page: 1, pageSize: 20 },
  currentTask: null,
  creating: false,

  fetchTasks: async (params) => {
    set({ loading: true });
    try {
      const merged = { ...get().filters, ...params };
      const res = await generationApi.listTasks(merged);
      const data = unwrapResponse(res);
      set({ tasks: data.items, total: data.total, loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载任务列表失败' });
    }
  },

  fetchTask: async (taskId) => {
    try {
      const task = unwrapResponse(await generationApi.taskDetail(taskId));
      set({ currentTask: task });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '加载任务详情失败' });
    }
  },

  createVideo: async (params) => {
    set({ creating: true });
    try {
      const task = unwrapResponse(await generationApi.create(params));
      set({ creating: false });
      useUIStore.getState().pushNotification({ type: 'success', title: '任务已创建' });
      return task;
    } catch {
      set({ creating: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '创建任务失败' });
      throw new Error('create failed');
    }
  },

  quickGenerate: async (params) => {
    set({ creating: true });
    try {
      const task = unwrapResponse(await generationApi.quickCreate(params));
      set({ creating: false });
      useUIStore.getState().pushNotification({ type: 'success', title: '快速成片任务已创建' });
      return task;
    } catch {
      set({ creating: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '快速成片失败' });
      throw new Error('quick generate failed');
    }
  },

  retry: async (taskId) => {
    try {
      const task = unwrapResponse(await generationApi.retry(taskId));
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? task : t)),
        currentTask: s.currentTask?.id === taskId ? task : s.currentTask,
      }));
      useUIStore.getState().pushNotification({ type: 'info', title: '任务已重新入队' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '重试失败' });
    }
  },

  cancel: async (taskId) => {
    try {
      const task = unwrapResponse(await generationApi.cancel(taskId));
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? task : t)),
        currentTask: s.currentTask?.id === taskId ? task : s.currentTask,
      }));
      useUIStore.getState().pushNotification({ type: 'info', title: '任务已取消' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '取消失败' });
    }
  },

  exportVideo: async (taskId, format, resolution, quality) => {
    const result = unwrapResponse(await generationApi.export(taskId, { format: format as 'mp4' | 'webm', resolution: resolution as '1080x1920' | '1920x1080' | '720x1280', quality: quality as 'high' | 'medium' | 'low' }));
    return result;
  },

  regenerateSceneVideo: async (taskId, sceneId, instruction, materialId) => {
    try {
      const task = unwrapResponse(await generationApi.regenerateScene(taskId, sceneId, {
        instruction,
        material_id: materialId,
      }));
      set((s) => ({
        currentTask: s.currentTask?.id === taskId ? task : s.currentTask,
      }));
      useUIStore.getState().pushNotification({ type: 'success', title: '分镜重生成已提交' });
    } catch {
      useUIStore.getState().pushNotification({ type: 'error', title: '分镜重生成失败' });
    }
  },

  // WebSocket 实时驱动
  updateTaskProgress: (taskId, progress) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, progress } : t)),
      currentTask: s.currentTask?.id === taskId ? { ...s.currentTask, progress } : s.currentTask,
    }));
  },

  setTaskDone: (taskId, result) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'done' as const, result, completed_at: new Date().toISOString() } : t,
      ),
      currentTask: s.currentTask?.id === taskId
        ? { ...s.currentTask, status: 'done' as const, result, completed_at: new Date().toISOString() }
        : s.currentTask,
    }));
    if (result) {
      useUIStore.getState().pushNotification({ type: 'success', title: '视频生成完成' });
    }
  },

  setTaskFailed: (taskId, error) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'failed' as const, error } : t)),
      currentTask: s.currentTask?.id === taskId
        ? { ...s.currentTask, status: 'failed' as const, error }
        : s.currentTask,
    }));
    useUIStore.getState().pushNotification({ type: 'error', title: '任务失败', message: error?.message });
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
