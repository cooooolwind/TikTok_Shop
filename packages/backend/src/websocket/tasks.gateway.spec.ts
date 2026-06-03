import { TasksGateway } from './tasks.gateway';

function makeGateway() {
  const gateway = new TasksGateway();
  const room = {
    emit: jest.fn(),
  };
  const server = {
    emit: jest.fn(),
    to: jest.fn(() => room),
  };

  gateway.server = server as never;

  return { gateway, server, room };
}

function makeSocket() {
  return {
    id: 'socket-1',
    join: jest.fn(),
    leave: jest.fn(),
  };
}

describe('TasksGateway', () => {
  it('subscribes clients to task rooms', () => {
    const { gateway } = makeGateway();
    const socket = makeSocket();

    gateway.handleSubscribe(socket as never, { task_id: 'task-1' });

    expect(socket.join).toHaveBeenCalledWith('task:task-1');
  });

  it('unsubscribes clients from task rooms', () => {
    const { gateway } = makeGateway();
    const socket = makeSocket();

    gateway.handleUnsubscribe(socket as never, { task_id: 'task-1' });

    expect(socket.leave).toHaveBeenCalledWith('task:task-1');
  });

  it('emits task progress to the task room', () => {
    const { gateway, server, room } = makeGateway();

    const progress = {
      current_step: 1,
      total_steps: 4,
      step_name: 'analyze',
      percentage: 25,
      message: 'analyzing',
      estimated_remaining: 30,
    };

    gateway.emitTaskProgress('task-1', progress);

    expect(server.to).toHaveBeenCalledWith('task:task-1');
    expect(room.emit).toHaveBeenCalledWith('task:progress', {
      task_id: 'task-1',
      progress,
    });
  });

  it('emits material analysis events globally', () => {
    const { gateway, server } = makeGateway();

    gateway.emitMaterialAnalyzed('material-1', ['product'], 'mock description');

    expect(server.emit).toHaveBeenCalledWith('material:analyzed', {
      material_id: 'material-1',
      ai_tags: ['product'],
      ai_description: 'mock description',
    });
  });

  it('emits material analysis failure events globally', () => {
    const { gateway, server } = makeGateway();

    gateway.emitMaterialAnalysisFailed('material-1', 'AI service unavailable');

    expect(server.emit).toHaveBeenCalledWith('material:analysis_failed', {
      material_id: 'material-1',
      error: 'AI service unavailable',
    });
  });

  it('emits script generated events globally', () => {
    const { gateway, server } = makeGateway();

    gateway.emitScriptGenerated('script-1');

    expect(server.emit).toHaveBeenCalledWith('script:generated', {
      script_id: 'script-1',
    });
  });
});
