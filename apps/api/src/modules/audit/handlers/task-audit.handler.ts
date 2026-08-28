import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { TasksEventBus } from '../../tasks/events/tasks.events';

@Injectable()
export class TaskAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TasksEventBus) private readonly events: TasksEventBus,
  ) {}

  onModuleInit() {
    this.events.onTaskCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.createdBy,
        action: 'task.created',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onTaskUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.updatedBy,
        action: 'task.updated',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId, title: p.title },
      });
    });

    this.events.onTaskMoved((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.movedBy,
        action: 'task.moved',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: {
          boardId: p.boardId,
          fromColumnId: p.fromColumnId,
          toColumnId: p.toColumnId,
        },
      });
    });

    this.events.onTaskDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'task.deleted',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId, title: p.title },
      });
    });
  }
}
