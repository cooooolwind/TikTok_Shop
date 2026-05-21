import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WsEvent } from '@aigc/shared-types';
import type {
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  MaterialAnalyzedEvent,
  ScriptGeneratedEvent,
} from '@aigc/shared-types';

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

  /** 推送任务进度 */
  emitTaskProgress(taskId: string, progress: TaskProgressEvent['progress']) {
    this.server.to(`task:${taskId}`).emit(WsEvent.TASK_PROGRESS, { task_id: taskId, progress });
  }

  /** 推送任务完成 */
  emitTaskCompleted(taskId: string, result: TaskCompletedEvent['result']) {
    this.server.to(`task:${taskId}`).emit(WsEvent.TASK_COMPLETED, { task_id: taskId, result });
  }

  /** 推送任务失败 */
  emitTaskFailed(taskId: string, error: TaskFailedEvent['error']) {
    this.server.to(`task:${taskId}`).emit(WsEvent.TASK_FAILED, { task_id: taskId, error });
  }

  /** 推送素材打标完成 */
  emitMaterialAnalyzed(materialId: string, aiTags: string[], aiDescription: string) {
    this.server.emit(WsEvent.MATERIAL_ANALYZED, {
      material_id: materialId,
      ai_tags: aiTags,
      ai_description: aiDescription,
    });
  }

  /** 推送剧本生成完成 */
  emitScriptGenerated(scriptId: string) {
    this.server.emit(WsEvent.SCRIPT_GENERATED, { script_id: scriptId });
  }
}
