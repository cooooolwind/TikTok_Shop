import type { GenerationTask, TaskProgress } from '@aigc/shared-types';

const ACTIVE_FALLBACK_PROGRESS: TaskProgress = {
  current_step: 0,
  total_steps: 5,
  step_name: 'queued',
  percentage: 0,
  message: '任务已提交，正在等待进度更新',
  estimated_remaining: 75,
};

export function getDisplayProgress(task: Pick<GenerationTask, 'status' | 'progress'>): TaskProgress {
  if (task.progress) return task.progress;
  if (task.status === 'processing') {
    return { ...ACTIVE_FALLBACK_PROGRESS, step_name: 'processing', message: '任务正在处理中，等待进度同步' };
  }
  return ACTIVE_FALLBACK_PROGRESS;
}
