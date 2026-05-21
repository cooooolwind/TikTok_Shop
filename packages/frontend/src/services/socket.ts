import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@aigc/shared-types';
import type {
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  MaterialAnalyzedEvent,
  ScriptGeneratedEvent,
} from '@aigc/shared-types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/tasks', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => console.log('[WS] Connected:', socket!.id));
    socket.on('disconnect', () => console.log('[WS] Disconnected'));
  }
  return socket;
}

export function subscribeTask(taskId: string) {
  getSocket().emit(WsEvent.SUBSCRIBE, { task_id: taskId });
}

export function unsubscribeTask(taskId: string) {
  getSocket().emit(WsEvent.UNSUBSCRIBE, { task_id: taskId });
}

export function onTaskProgress(cb: (data: TaskProgressEvent) => void) {
  getSocket().on(WsEvent.TASK_PROGRESS, cb);
  return () => getSocket().off(WsEvent.TASK_PROGRESS, cb);
}

export function onTaskCompleted(cb: (data: TaskCompletedEvent) => void) {
  getSocket().on(WsEvent.TASK_COMPLETED, cb);
  return () => getSocket().off(WsEvent.TASK_COMPLETED, cb);
}

export function onTaskFailed(cb: (data: TaskFailedEvent) => void) {
  getSocket().on(WsEvent.TASK_FAILED, cb);
  return () => getSocket().off(WsEvent.TASK_FAILED, cb);
}

export function onMaterialAnalyzed(cb: (data: MaterialAnalyzedEvent) => void) {
  getSocket().on(WsEvent.MATERIAL_ANALYZED, cb);
  return () => getSocket().off(WsEvent.MATERIAL_ANALYZED, cb);
}

export function onScriptGenerated(cb: (data: ScriptGeneratedEvent) => void) {
  getSocket().on(WsEvent.SCRIPT_GENERATED, cb);
  return () => getSocket().off(WsEvent.SCRIPT_GENERATED, cb);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
