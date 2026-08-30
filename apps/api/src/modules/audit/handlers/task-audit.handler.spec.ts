import { Test, TestingModule } from '@nestjs/testing';

import { TaskAuditHandler } from './task-audit.handler';
import { AuditService } from '../services/audit.service';
import { TasksEventBus } from '../../tasks/events/tasks.events';

describe('TaskAuditHandler', () => {
  let handler: TaskAuditHandler;
  let audit: { record: jest.Mock };
  let bus: TasksEventBus;

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskAuditHandler,
        TasksEventBus,
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    handler = module.get(TaskAuditHandler);
    bus = module.get(TasksEventBus);
    handler.onModuleInit();
  });

  it('records task.created via the event bus', () => {
    bus.publishTaskCreated({
      taskId: 't-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      columnId: 'c-1',
      createdBy: 'u-1',
      title: 'Write spec',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'task.created',
      resourceType: 'task',
      resourceId: 't-1',
      metadata: { boardId: 'b-1' },
    });
  });

  it('records task.updated via the event bus', () => {
    bus.publishTaskUpdated({
      taskId: 't-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      updatedBy: 'u-2',
      title: 'Write spec v2',
      previousAssigneeId: null,
      assigneeId: 'u-3',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-2',
      action: 'task.updated',
      resourceType: 'task',
      resourceId: 't-1',
      metadata: {
        boardId: 'b-1',
        title: 'Write spec v2',
        assigneeChange: { from: null, to: 'u-3' },
      },
    });
  });

  it('records an assignee reassignment delta and omits the key when there is no change', () => {
    bus.publishTaskUpdated({
      taskId: 't-2',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      updatedBy: 'u-2',
      title: 'Reassign',
      previousAssigneeId: 'u-1',
      assigneeId: 'u-4',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 't-2',
        metadata: {
          boardId: 'b-1',
          title: 'Reassign',
          assigneeChange: { from: 'u-1', to: 'u-4' },
        },
      }),
    );

    bus.publishTaskUpdated({
      taskId: 't-3',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      updatedBy: 'u-2',
      title: 'Title only',
      previousAssigneeId: 'u-5',
      assigneeId: 'u-5',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 't-3',
        metadata: { boardId: 'b-1', title: 'Title only' },
      }),
    );
  });

  it('records task.moved via the event bus', () => {
    bus.publishTaskMoved({
      taskId: 't-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      fromColumnId: 'c-1',
      toColumnId: 'c-2',
      movedBy: 'u-2',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-2',
      action: 'task.moved',
      resourceType: 'task',
      resourceId: 't-1',
      metadata: { boardId: 'b-1', fromColumnId: 'c-1', toColumnId: 'c-2' },
    });
  });

  it('records task.deleted via the event bus', () => {
    bus.publishTaskDeleted({
      taskId: 't-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      deletedBy: 'u-2',
      title: 'Write spec',
      assigneeId: null,
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-2',
      action: 'task.deleted',
      resourceType: 'task',
      resourceId: 't-1',
      metadata: { boardId: 'b-1', title: 'Write spec' },
    });
  });
});
