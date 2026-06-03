import type { TaskProgress, TaskResult, TaskError } from './generation';

// ===== Socket.IO 事件常量 =====

export const WsEvent = {
  // 客户端 → 服务端
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',

  // 服务端 → 客户端
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  MATERIAL_ANALYZED: 'material:analyzed',
  MATERIAL_ANALYSIS_FAILED: 'material:analysis_failed',
  SCRIPT_GENERATED: 'script:generated',
} as const;

// ===== 事件负载类型 =====

export interface SubscribePayload {
  task_id: string;
}

export interface UnsubscribePayload {
  task_id: string;
}

export interface TaskProgressEvent {
  task_id: string;
  progress: TaskProgress;
}

export interface TaskCompletedEvent {
  task_id: string;
  result: TaskResult;
}

export interface TaskFailedEvent {
  task_id: string;
  error: TaskError;
}

export interface MaterialAnalyzedEvent {
  material_id: string;
  ai_tags: string[];
  ai_description: string;
}

export interface MaterialAnalysisFailedEvent {
  material_id: string;
  error: string;
}

export interface ScriptGeneratedEvent {
  script_id: string;
}
