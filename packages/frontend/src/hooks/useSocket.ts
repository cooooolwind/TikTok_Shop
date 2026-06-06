import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@aigc/shared-types';
import type {
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  MaterialAnalyzedEvent,
  MaterialAnalysisFailedEvent,
  MaterialAnalysisStepEvent,
  MaterialEmbeddingCompleteEvent,
  MaterialEmbeddingFailedEvent,
  ScriptGeneratedEvent,
} from '@aigc/shared-types';

export interface UseSocketReturn {
  socket: Socket | null;
  subscribe: (taskId: string) => void;
  unsubscribe: (taskId: string) => void;
  onProgress: (cb: (data: TaskProgressEvent) => void) => () => void;
  onCompleted: (cb: (data: TaskCompletedEvent) => void) => () => void;
  onFailed: (cb: (data: TaskFailedEvent) => void) => () => void;
  onMaterialAnalyzed: (cb: (data: MaterialAnalyzedEvent) => void) => () => void;
  onMaterialAnalysisFailed: (cb: (data: MaterialAnalysisFailedEvent) => void) => () => void;
  onMaterialAnalysisStep: (cb: (data: MaterialAnalysisStepEvent) => void) => () => void;
  onMaterialEmbeddingComplete: (cb: (data: MaterialEmbeddingCompleteEvent) => void) => () => void;
  onMaterialEmbeddingFailed: (cb: (data: MaterialEmbeddingFailedEvent) => void) => () => void;
  onScriptGenerated: (cb: (data: ScriptGeneratedEvent) => void) => () => void;
}

/**
 * Socket.IO 连接管理 Hook
 * - 自动连接 /tasks namespace
 * - 断线自动重连
 * - 组件卸载时 clean up
 */
export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('/tasks', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => console.log('[WS] Connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[WS] Disconnected:', reason));
    socket.on('connect_error', (err) => console.warn('[WS] Connect error:', err.message));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback((taskId: string) => {
    socketRef.current?.emit(WsEvent.SUBSCRIBE, { task_id: taskId });
  }, []);

  const unsubscribe = useCallback((taskId: string) => {
    socketRef.current?.emit(WsEvent.UNSUBSCRIBE, { task_id: taskId });
  }, []);

  const onProgress = useCallback((cb: (data: TaskProgressEvent) => void) => {
    socketRef.current?.on(WsEvent.TASK_PROGRESS, cb);
    return () => { socketRef.current?.off(WsEvent.TASK_PROGRESS, cb); };
  }, []);

  const onCompleted = useCallback((cb: (data: TaskCompletedEvent) => void) => {
    socketRef.current?.on(WsEvent.TASK_COMPLETED, cb);
    return () => { socketRef.current?.off(WsEvent.TASK_COMPLETED, cb); };
  }, []);

  const onFailed = useCallback((cb: (data: TaskFailedEvent) => void) => {
    socketRef.current?.on(WsEvent.TASK_FAILED, cb);
    return () => { socketRef.current?.off(WsEvent.TASK_FAILED, cb); };
  }, []);

  const onMaterialAnalyzed = useCallback((cb: (data: MaterialAnalyzedEvent) => void) => {
    socketRef.current?.on(WsEvent.MATERIAL_ANALYZED, cb);
    return () => { socketRef.current?.off(WsEvent.MATERIAL_ANALYZED, cb); };
  }, []);

  const onMaterialAnalysisFailed = useCallback((cb: (data: MaterialAnalysisFailedEvent) => void) => {
    socketRef.current?.on(WsEvent.MATERIAL_ANALYSIS_FAILED, cb);
    return () => { socketRef.current?.off(WsEvent.MATERIAL_ANALYSIS_FAILED, cb); };
  }, []);

  const onMaterialAnalysisStep = useCallback((cb: (data: MaterialAnalysisStepEvent) => void) => {
    socketRef.current?.on(WsEvent.MATERIAL_ANALYSIS_STEP, cb);
    return () => { socketRef.current?.off(WsEvent.MATERIAL_ANALYSIS_STEP, cb); };
  }, []);

  const onMaterialEmbeddingComplete = useCallback((cb: (data: MaterialEmbeddingCompleteEvent) => void) => {
    socketRef.current?.on(WsEvent.MATERIAL_EMBEDDING_COMPLETE, cb);
    return () => { socketRef.current?.off(WsEvent.MATERIAL_EMBEDDING_COMPLETE, cb); };
  }, []);

  const onMaterialEmbeddingFailed = useCallback((cb: (data: MaterialEmbeddingFailedEvent) => void) => {
    socketRef.current?.on(WsEvent.MATERIAL_EMBEDDING_FAILED, cb);
    return () => { socketRef.current?.off(WsEvent.MATERIAL_EMBEDDING_FAILED, cb); };
  }, []);

  const onScriptGenerated = useCallback((cb: (data: ScriptGeneratedEvent) => void) => {
    socketRef.current?.on(WsEvent.SCRIPT_GENERATED, cb);
    return () => { socketRef.current?.off(WsEvent.SCRIPT_GENERATED, cb); };
  }, []);

  return {
    socket: socketRef.current,
    subscribe,
    unsubscribe,
    onProgress,
    onCompleted,
    onFailed,
    onMaterialAnalyzed,
    onMaterialAnalysisFailed,
    onMaterialAnalysisStep,
    onMaterialEmbeddingComplete,
    onMaterialEmbeddingFailed,
    onScriptGenerated,
  };
}
