import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  and,
  DATABASE,
  desc,
  eq,
  inArray,
  isNull,
  or,
  type Db,
  type TaskRow,
  type WorkspaceRole,
  workspaceMembers,
  tasks,
  boards,
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

    // Verify the ownership chain column -> board -> workspace before
    // pinning the task: trusting path params independently allowed a
    // task to be created on a foreign board's column.
    const board = await this.tasksRepo.findBoardById(boardId);
    if (!board || board.workspaceId !== workspaceId) {
      throw new TasksException(
        TasksErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    const column = await this.tasksRepo.findColumnById(columnId);
    if (!column || column.boardId !== boardId) {
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

  public async getById(taskId: string, userId: string): Promise<TaskRow> {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new TasksException(
        TasksErrorCode.TASK_NOT_FOUND,
        'Task not found.',
      );
    }
    // Tasks are private to their workspace — a member of any rank may view,
    // but non-members must not read arbitrary tasks by id.
    await this.requireRole(task.workspaceId, userId, 'VIEWER');
    return task;
  }

  public async listByBoard(
    boardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<TaskRow[]> {
    await this.requireRole(workspaceId, userId, 'VIEWER');
    await this.assertBoardInWorkspace(boardId, workspaceId);
    return this.tasksRepo.listByBoard(boardId);
  }

  public async listByColumn(
    columnId: string,
    boardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<TaskRow[]> {
    await this.requireRole(workspaceId, userId, 'VIEWER');
    await this.assertBoardInWorkspace(boardId, workspaceId);

    const column = await this.tasksRepo.findColumnById(columnId);
    if (!column || column.boardId !== boardId) {
      throw new TasksException(
        TasksErrorCode.COLUMN_NOT_FOUND,
        'Column not found.',
      );
    }

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

    // A task must stay within its own board — moving to a column of a
    // different board would leave board_id and column_id pointing at
    // different boards (silent cross-board corruption).
    if (column.boardId !== task.boardId) {
      throw new TasksException(
        TasksErrorCode.COLUMN_NOT_FOUND,
        'Target column does not belong to this board.',
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

  public async listByUser(
    userId: string,
    opts?: { limit?: number; includeDone?: boolean },
  ): Promise<(TaskRow & { boardName: string; workspaceName: string })[]> {
    const memberships = await this.db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      );

    if (memberships.length === 0) return [];

    const workspaceIds = memberships.map((m) => m.workspaceId);

    const rows = await this.db
      .select({
        task: tasks,
        boardName: boards.name,
      })
      .from(tasks)
      .innerJoin(boards, eq(tasks.boardId, boards.id))
      .where(
        and(
          inArray(tasks.workspaceId, workspaceIds),
          or(eq(tasks.status, 'TODO'), eq(tasks.status, 'IN_PROGRESS')),
          isNull(tasks.deletedAt),
        ),
      )
      .orderBy(tasks.dueDate ? desc(tasks.dueDate) : desc(tasks.createdAt))
      .limit(opts?.limit ?? 100);

    return rows.map((r) => ({
      ...r.task,
      boardName: r.boardName,
      workspaceName: '',
    }));
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

  private async assertBoardInWorkspace(
    boardId: string,
    workspaceId: string,
  ): Promise<void> {
    const board = await this.tasksRepo.findBoardById(boardId);
    if (!board || board.workspaceId !== workspaceId) {
      // Same error whether missing or foreign: never leak existence
      // across tenant boundaries.
      throw new TasksException(
        TasksErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
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
