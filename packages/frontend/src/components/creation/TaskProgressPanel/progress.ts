import type { GenerationTask, TaskProgress } from '@aigc/shared-types';

const ACTIVE_FALLBACK_PROGRESS: TaskProgress = {
  current_step: 0,
  total_steps: 5,
  step_name: 'queued',
  percentage: 0,
  message: '任务已提交，正在等待进度更新',
  estimated_remaining: 75,
  phase: 'queued',
  phase_label: '排队中',
};

export function getDisplayProgress(task: Pick<GenerationTask, 'status' | 'progress'>): TaskProgress {
  if (task.progress) return task.progress;
  if (task.status === 'processing') {
    return { ...ACTIVE_FALLBACK_PROGRESS, step_name: 'processing', message: '任务正在处理中，等待进度同步' };
  }
  return ACTIVE_FALLBACK_PROGRESS;
}

export function formatProgressTime(seconds?: number) {
  const value = Math.max(Math.round(seconds ?? 0), 0);
  if (value < 60) return `${value}秒`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${minutes}分${rest}秒` : `${minutes}分`;
}

export function getProgressShortText(progress: TaskProgress) {
  if (progress.segment_index && progress.segment_total) {
    return `${progress.phase_label ?? progress.step_name} ${progress.segment_index}/${progress.segment_total}`;
  }
  return progress.phase_label ?? progress.message;
}

export function formatDisplayProgress(progress: TaskProgress) {
  return progress.message;
}
