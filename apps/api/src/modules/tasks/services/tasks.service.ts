import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  type Db,
  type TaskRow,
  type WorkspaceRole,
  workspaceMembers,
} from '@repo/database';

import { TasksErrorCode, TasksException } from '../errors/tasks.errors';
import { TaskPolicy } from '../policies/task.policy';
import { TasksRepository } from '../repositories/tasks.repository';
import { TasksEventBus } from '../events/tasks.events';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(TasksRepository) private readonly tasksRepo: TasksRepository,
    @Inject(TaskPolicy) private readonly policy: TaskPolicy,
    @Inject(TasksEventBus) private readonly events: TasksEventBus,
  ) {}

  public async create(
    columnId: string,
    boardId: string,
    workspaceId: string,
    userId: string,
    input: {
      title: string;
      description?: string;
      status?: TaskRow['status'];
      priority?: TaskRow['priority'];
      assigneeId?: string;
      dueDate?: string | null;
      position?: number;
    },
  ): Promise<TaskRow> {
    await this.requireRole(workspaceId, userId, 'EDITOR');
    if (input.assigneeId) {
      await this.requireAssigneeIsMember(workspaceId, input.assigneeId);
    }

    const column = await this.tasksRepo.findColumnById(columnId);
    if (!column) {
      throw new TasksException(
        TasksErrorCode.COLUMN_NOT_FOUND,
        'Column not found.',
      );
    }

    const task = await this.tasksRepo.create({
      workspaceId,
      boardId,
      columnId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'TODO',
      priority: input.priority ?? 'NONE',
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createdById: userId,
      position: input.position ?? 0,
    });

    this.events.publishTaskCreated({
      taskId: task.id,
      boardId,
      columnId,
      createdBy: userId,
      assigneeId: task.assigneeId ?? undefined,
      title: task.title,
    });

    return task;
  }

  public async getById(taskId: string): Promise<TaskRow> {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new TasksException(
        TasksErrorCode.TASK_NOT_FOUND,
        'Task not found.',
      );
    }
    return task;
  }

  public async listByBoard(
    boardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<TaskRow[]> {
    await this.requireRole(workspaceId, userId, 'VIEWER');
    return this.tasksRepo.listByBoard(boardId);
  }

  public async listByColumn(
    columnId: string,
    boardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<TaskRow[]> {
    await this.requireRole(workspaceId, userId, 'VIEWER');
    return this.tasksRepo.listByColumn(columnId);
  }

  public async update(
    taskId: string,
    userId: string,
    input: {
      title?: string;
      description?: string | null;
      status?: TaskRow['status'];
      priority?: TaskRow['priority'];
      assigneeId?: string | null;
      dueDate?: string | null;
      position?: number;
    },
  ): Promise<TaskRow> {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new TasksException(
        TasksErrorCode.TASK_NOT_FOUND,
        'Task not found.',
      );
    }

    await this.requireRole(task.workspaceId, userId, 'EDITOR');
    if (typeof input.assigneeId === 'string') {
      await this.requireAssigneeIsMember(task.workspaceId, input.assigneeId);
    }

    const { dueDate, ...rest } = input;

    const updateData: Parameters<typeof this.tasksRepo.update>[1] = {
      ...rest,
    };

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (input.status === 'DONE' && task.status !== 'DONE') {
      updateData.completedAt = new Date();
    } else if (input.status && input.status !== 'DONE') {
      updateData.completedAt = null;
    }

    const updated = await this.tasksRepo.update(taskId, updateData);
    this.events.publishTaskUpdated({
      taskId,
      updatedBy: userId,
      title: updated.title,
      previousAssigneeId: task.assigneeId,
      assigneeId: updated.assigneeId,
    });
    return updated;
  }

  public async move(
    taskId: string,
    userId: string,
    targetColumnId: string,
    position?: number,
  ): Promise<TaskRow> {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new TasksException(
        TasksErrorCode.TASK_NOT_FOUND,
        'Task not found.',
      );
    }

    await this.requireRole(task.workspaceId, userId, 'EDITOR');

    const column = await this.tasksRepo.findColumnById(targetColumnId);
    if (!column) {
      throw new TasksException(
        TasksErrorCode.COLUMN_NOT_FOUND,
        'Target column not found.',
      );
    }

    const fromColumnId = task.columnId;
    const updated = await this.tasksRepo.update(taskId, {
      columnId: targetColumnId,
      position: position ?? 0,
    });

    this.events.publishTaskMoved({
      taskId,
      fromColumnId,
      toColumnId: targetColumnId,
      movedBy: userId,
    });

    return updated;
  }

  public async delete(taskId: string, userId: string): Promise<void> {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new TasksException(
        TasksErrorCode.TASK_NOT_FOUND,
        'Task not found.',
      );
    }

    await this.requireRole(task.workspaceId, userId, 'EDITOR');
    await this.tasksRepo.softDelete(taskId);
    this.events.publishTaskDeleted({
      taskId,
      deletedBy: userId,
      title: task.title,
      assigneeId: task.assigneeId,
    });
  }

  private async requireAssigneeIsMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const [membership] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new TasksException(
        TasksErrorCode.NOT_A_MEMBER,
        'Cannot assign to a user who is not an active member of this workspace.',
      );
    }
  }

  private async requireRole(
    workspaceId: string,
    userId: string,
    minimumRole: WorkspaceRole,
  ): Promise<void> {
    const [membership] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new TasksException(
        TasksErrorCode.NOT_A_MEMBER,
        'You are not a member of this workspace.',
      );
    }

    if (!this.policy.isAtLeast(membership.role, minimumRole)) {
      throw new TasksException(
        TasksErrorCode.INSUFFICIENT_ROLE,
        `Requires ${minimumRole} role or higher.`,
      );
    }
  }
}
