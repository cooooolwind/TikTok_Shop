import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  MaterialAnalyzedEvent,
  MaterialAnalysisFailedEvent,
  MaterialAnalysisStepEvent,
  ScriptGeneratedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskProgressEvent,
} from '@aigc/shared-types';
import { Server, Socket } from 'socket.io';

const WsEvent = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  MATERIAL_ANALYZED: 'material:analyzed',
  MATERIAL_ANALYSIS_FAILED: 'material:analysis_failed',
  MATERIAL_ANALYSIS_STEP: 'material:analysis_step',
  SCRIPT_GENERATED: 'script:generated',
} as const;

@WebSocketGateway({
  namespace: '/tasks',
  cors: { origin: '*', credentials: true },
})
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TasksGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WsEvent.SUBSCRIBE)
  handleSubscribe(client: Socket, payload: { task_id: string }) {
    const room = `task:${payload.task_id}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  @SubscribeMessage(WsEvent.UNSUBSCRIBE)
  handleUnsubscribe(client: Socket, payload: { task_id: string }) {
    const room = `task:${payload.task_id}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  emitTaskProgress(taskId: string, progress: TaskProgressEvent['progress']) {
    this.server.to(`task:${taskId}`).emit(WsEvent.TASK_PROGRESS, { task_id: taskId, progress });
  }

  emitTaskCompleted(taskId: string, result: TaskCompletedEvent['result']) {
    this.server.to(`task:${taskId}`).emit(WsEvent.TASK_COMPLETED, { task_id: taskId, result });
  }

  emitTaskFailed(taskId: string, error: TaskFailedEvent['error']) {
    this.server.to(`task:${taskId}`).emit(WsEvent.TASK_FAILED, { task_id: taskId, error });
  }

  emitMaterialAnalyzed(materialId: string, aiTags: string[], aiDescription: string) {
    const payload: MaterialAnalyzedEvent = {
      material_id: materialId,
      ai_tags: aiTags,
      ai_description: aiDescription,
    };
    this.server.emit(WsEvent.MATERIAL_ANALYZED, payload);
  }

  emitMaterialAnalysisFailed(materialId: string, error: string) {
    const payload: MaterialAnalysisFailedEvent = {
      material_id: materialId,
      error,
    };
    this.server.emit(WsEvent.MATERIAL_ANALYSIS_FAILED, payload);
  }

  emitMaterialAnalysisStep(materialId: string, step: MaterialAnalysisStepEvent['step']) {
    const payload: MaterialAnalysisStepEvent = {
      material_id: materialId,
      step,
    };
    this.server.emit(WsEvent.MATERIAL_ANALYSIS_STEP, payload);
  }

  emitScriptGenerated(scriptId: string) {
    const payload: ScriptGeneratedEvent = { script_id: scriptId };
    this.server.emit(WsEvent.SCRIPT_GENERATED, payload);
  }
}
