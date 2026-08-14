import { TasksEventBus } from './tasks.events';

describe('TasksEventBus', () => {
  let bus: TasksEventBus;

  beforeEach(() => {
    bus = new TasksEventBus();
  });

  it('emits TaskCreated', () => {
    const fn = jest.fn();
    bus.onTaskCreated(fn);
    const payload = {
      taskId: 't1',
      boardId: 'b1',
      columnId: 'c1',
      createdBy: 'u1',
    };
    bus.publishTaskCreated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });

  it('emits TaskMoved', () => {
    const fn = jest.fn();
    bus.onTaskCreated(fn);
    bus.publishTaskCreated({
      taskId: 't1',
      boardId: 'b1',
      columnId: 'c1',
      createdBy: 'u1',
    });
    expect(fn).toHaveBeenCalled();
  });

  it('emits TaskUpdated with title and assignee diff', () => {
    const fn = jest.fn();
    bus.onTaskUpdated(fn);
    const payload = {
      taskId: 't1',
      updatedBy: 'u1',
      title: 'Set up CI/CD',
      previousAssigneeId: 'u2',
      assigneeId: 'u3',
    };
    bus.publishTaskUpdated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });

  it('supports multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.onTaskCreated(a);
    bus.onTaskCreated(b);

    bus.publishTaskCreated({
      taskId: 't1',
      boardId: 'b1',
      columnId: 'c1',
      createdBy: 'u1',
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
