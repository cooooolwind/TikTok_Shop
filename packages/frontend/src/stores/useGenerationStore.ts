import { create } from 'zustand';
import type { GenerationTask, GenerationListQuery } from '@aigc/shared-types';
import { generationApi } from '../services/generation.api';

interface GenerationState {
  tasks: GenerationTask[];
  total: number;
  loading: boolean;
  currentTask: GenerationTask | null;
  filters: GenerationListQuery;

  fetchTasks: (params?: GenerationListQuery) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  updateTaskProgress: (taskId: string, progress: GenerationTask['progress']) => void;
  setTaskDone: (taskId: string, result: GenerationTask['result']) => void;
  setTaskFailed: (taskId: string, error: GenerationTask['error']) => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  tasks: [],
  total: 0,
  loading: false,
  currentTask: null,
  filters: { page: 1, pageSize: 20 },

  fetchTasks: async (params) => {
    set({ loading: true });
    const res = await generationApi.listTasks(params);
    set({ tasks: res.data.items, total: res.data.total, loading: false });
  },

  fetchTask: async (taskId) => {
    const task = await generationApi.taskDetail(taskId);
    set({ currentTask: task });
  },

  updateTaskProgress: (taskId, progress) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, progress } : t)),
      currentTask: s.currentTask?.id === taskId ? { ...s.currentTask, progress } : s.currentTask,
    }));
  },

  setTaskDone: (taskId, result) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'done', result } : t)),
      currentTask: s.currentTask?.id === taskId
        ? { ...s.currentTask, status: 'done', result }
        : s.currentTask,
    }));
  },

  setTaskFailed: (taskId, error) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'failed', error } : t)),
      currentTask: s.currentTask?.id === taskId
        ? { ...s.currentTask, status: 'failed', error }
        : s.currentTask,
    }));
  },
}));
