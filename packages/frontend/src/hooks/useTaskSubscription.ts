import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useCreationStore } from '../stores/useGenerationStore';
import { generationApi } from '../services/generation.api';

/**
 * 订阅单个任务的实时进度 — WebSocket 为主，5s 轮询为降级兜底
 * 组件挂载时 subscribe，卸载时 unsubscribe + 停止轮询
 */
export function useTaskSubscription(taskId: string | undefined) {
  const { subscribe, unsubscribe, onProgress, onCompleted, onFailed } = useSocket();
  const updateProgress = useCreationStore((s) => s.updateTaskProgress);
  const setTaskDone = useCreationStore((s) => s.setTaskDone);
  const setTaskFailed = useCreationStore((s) => s.setTaskFailed);

  useEffect(() => {
    if (!taskId) return;

    // WebSocket 订阅
    subscribe(taskId);

    // 事件监听
    const unsubProgress = onProgress((data) => {
      if (data.task_id === taskId) updateProgress(taskId, data.progress);
    });
    const unsubCompleted = onCompleted((data) => {
      if (data.task_id === taskId && data.result) setTaskDone(taskId, data.result);
    });
    const unsubFailed = onFailed((data) => {
      if (data.task_id === taskId && data.error) setTaskFailed(taskId, data.error);
    });

    // 降级：5s 轮询兜底，防止 WebSocket 连接失败丢进度
    const pollInterval = setInterval(async () => {
      try {
        const task = await generationApi.taskDetail(taskId);
        if (task.status === 'done' && task.result) {
          setTaskDone(taskId, task.result);
          clearInterval(pollInterval);
        } else if (task.status === 'failed') {
          setTaskFailed(taskId, task.error ?? { code: 'UNKNOWN', message: '任务失败', retryable: false });
          clearInterval(pollInterval);
        } else {
          updateProgress(taskId, task.progress);
        }
      } catch {
        // 轮询失败静默忽略
      }
    }, 5000);

    return () => {
      unsubscribe(taskId);
      unsubProgress();
      unsubCompleted();
      unsubFailed();
      clearInterval(pollInterval);
    };
  }, [taskId, subscribe, unsubscribe, onProgress, onCompleted, onFailed, updateProgress, setTaskDone, setTaskFailed]);
}
