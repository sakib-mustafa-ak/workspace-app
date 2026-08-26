import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  type Db,
  type WorkspaceRole,
  type BoardRow,
  type BoardColumnRow,
  workspaceMembers,
} from '@repo/database';

import { BoardsErrorCode, BoardsException } from '../errors/boards.errors';
import { BoardPolicy } from '../policies/board.policy';
import { BoardsRepository } from '../repositories/boards.repository';
import { BoardColumnsRepository } from '../repositories/board-columns.repository';
import { BoardsEventBus } from '../events/boards.events';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import type { BoardExportData } from '../dto/board-export.dto';
import type { BoardTemplate } from '../dto/create-board-template.dto';
import { getTemplateColumns } from '../dto/create-board-template.dto';
import type { TaskPriority } from '@repo/database';

@Injectable()
export class BoardsService {
  private readonly logger = new Logger(BoardsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(BoardsRepository) private readonly boardsRepo: BoardsRepository,
    @Inject(BoardColumnsRepository)
    private readonly columnsRepo: BoardColumnsRepository,
    @Inject(BoardPolicy) private readonly policy: BoardPolicy,
    @Inject(BoardsEventBus) private readonly events: BoardsEventBus,
    @Inject(TasksRepository) private readonly tasksRepo: TasksRepository,
  ) {}

  public async createFromTemplate(
    workspaceId: string,
    userId: string,
    input: { name: string; template: BoardTemplate },
  ): Promise<BoardRow> {
    await this.requireRole(workspaceId, userId, 'EDITOR');

    const board = await this.db.transaction(async (tx) => {
      const created = await this.boardsRepo.create(
        {
          workspaceId,
          name: input.name,
          description: null,
          position: 0,
        },
        tx,
      );

      const columns = getTemplateColumns(input.template);
      for (let i = 0; i < columns.length; i++) {
        await this.columnsRepo.create(
          {
            boardId: created.id,
            name: columns[i],
            position: i,
          },
          tx,
        );
      }

      return created;
    });

    this.events.publishBoardCreated({
      boardId: board.id,
      workspaceId,
      createdBy: userId,
    });

    return board;
  }

  public async create(
    workspaceId: string,
    userId: string,
    input: { name: string; description?: string },
  ): Promise<BoardRow> {
    await this.requireRole(workspaceId, userId, 'EDITOR');

    // Board and its default columns are one atomic unit: a partial
    // board without all three columns would break the kanban view.
    const board = await this.db.transaction(async (tx) => {
      const existing = await this.listByWorkspace(workspaceId, userId);
      const nextPosition = existing.length;
      const created = await this.boardsRepo.create(
        {
          workspaceId,
          name: input.name,
          description: input.description ?? null,
          position: nextPosition,
        },
        tx,
      );

      await this.columnsRepo.create(
        { boardId: created.id, name: 'To Do', position: 0 },
        tx,
      );
      await this.columnsRepo.create(
        { boardId: created.id, name: 'In Progress', position: 1 },
        tx,
      );
      await this.columnsRepo.create(
        { boardId: created.id, name: 'Done', position: 2 },
        tx,
      );

      return created;
    });

    this.events.publishBoardCreated({
      boardId: board.id,
      workspaceId,
      createdBy: userId,
    });

    return board;
  }

  public async getById(
    workspaceId: string,
    userId: string,
    boardId: string,
  ): Promise<BoardRow> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board || board.workspaceId !== workspaceId) {
      // Same error whether missing or foreign: never leak existence
      // across tenant boundaries.
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'VIEWER');

    return board;
  }

  public async listByWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<BoardRow[]> {
    await this.requireRole(workspaceId, userId, 'VIEWER');
    return this.boardsRepo.listByWorkspace(workspaceId);
  }

  public async update(
    boardId: string,
    userId: string,
    input: { name?: string; description?: string | null },
  ): Promise<BoardRow> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'EDITOR');

    if (board.status === 'ARCHIVED') {
      throw new BoardsException(
        BoardsErrorCode.BOARD_ARCHIVED,
        'Cannot update an archived board.',
      );
    }

    const updated = await this.boardsRepo.update(boardId, input);
    this.events.publishBoardUpdated({
      boardId,
      workspaceId: board.workspaceId,
      updatedBy: userId,
    });
    return updated;
  }

  public async archive(boardId: string, userId: string): Promise<void> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'ADMIN');
    await this.boardsRepo.archive(boardId);
    this.events.publishBoardArchived({
      boardId,
      workspaceId: board.workspaceId,
      archivedBy: userId,
    });
  }

  public async unarchive(boardId: string, userId: string): Promise<void> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'OWNER');
    await this.boardsRepo.unarchive(boardId);
  }

  public async delete(boardId: string, userId: string): Promise<void> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'ADMIN');
    await this.boardsRepo.softDelete(boardId);
    this.events.publishBoardDeleted({
      boardId,
      workspaceId: board.workspaceId,
      deletedBy: userId,
    });
  }

  public async getColumns(
    boardId: string,
    userId: string,
  ): Promise<BoardColumnRow[]> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'VIEWER');
    return this.columnsRepo.listByBoard(boardId);
  }

  public async createColumn(
    boardId: string,
    userId: string,
    input: { name: string; position?: number },
  ): Promise<BoardColumnRow> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'EDITOR');

    if (board.status === 'ARCHIVED') {
      throw new BoardsException(
        BoardsErrorCode.BOARD_ARCHIVED,
        'Cannot add columns to an archived board.',
      );
    }

    const existing = await this.columnsRepo.listByBoard(boardId);
    const nextPosition = existing.length;
    const column = await this.columnsRepo.create({
      boardId,
      name: input.name,
      position: input.position ?? nextPosition,
    });

    this.events.publishColumnCreated({
      columnId: column.id,
      boardId,
      workspaceId: board.workspaceId,
      createdBy: userId,
    });

    return column;
  }

  public async updateColumn(
    columnId: string,
    userId: string,
    input: { name?: string; position?: number },
  ): Promise<BoardColumnRow> {
    const column = await this.columnsRepo.findById(columnId);
    if (!column) {
      throw new BoardsException(
        BoardsErrorCode.COLUMN_NOT_FOUND,
        'Column not found.',
      );
    }

    const board = await this.boardsRepo.findById(column.boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'EDITOR');

    if (board.status === 'ARCHIVED') {
      throw new BoardsException(
        BoardsErrorCode.BOARD_ARCHIVED,
        'Cannot update columns in an archived board.',
      );
    }

    const updated = await this.columnsRepo.update(columnId, input);
    this.events.publishColumnUpdated({
      columnId,
      boardId: board.id,
      workspaceId: board.workspaceId,
      updatedBy: userId,
    });

    return updated;
  }

  public async archiveColumn(columnId: string, userId: string): Promise<void> {
    const column = await this.columnsRepo.findById(columnId);
    if (!column) {
      throw new BoardsException(
        BoardsErrorCode.COLUMN_NOT_FOUND,
        'Column not found.',
      );
    }

    const board = await this.boardsRepo.findById(column.boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'ADMIN');
    await this.columnsRepo.archive(columnId);
    this.events.publishColumnArchived({
      columnId,
      boardId: board.id,
      workspaceId: board.workspaceId,
      archivedBy: userId,
    });
  }

  public async exportBoard(
    boardId: string,
    userId: string,
  ): Promise<BoardExportData> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'VIEWER');

    const columns = await this.columnsRepo.listByBoard(boardId);
    const allTasks = await this.tasksRepo.listByBoard(boardId);

    return {
      board: { name: board.name, description: board.description },
      columns: columns.map((c) => ({ name: c.name, position: c.position })),
      tasks: allTasks.map((t) => ({
        title: t.title,
        description: t.description,
        position: t.position,
        priority: t.priority,
        columnName: columns.find((c) => c.id === t.columnId)?.name ?? '',
      })),
    };
  }

  public async importBoard(
    workspaceId: string,
    userId: string,
    data: BoardExportData,
  ): Promise<BoardRow> {
    await this.requireRole(workspaceId, userId, 'EDITOR');

    const board = await this.db.transaction(async (tx) => {
      const created = await this.boardsRepo.create(
        {
          workspaceId,
          name: data.board.name,
          description: data.board.description ?? null,
          position: 0,
        },
        tx,
      );

      const columnMap = new Map<string, string>();
      for (const col of data.columns) {
        const column = await this.columnsRepo.create(
          {
            boardId: created.id,
            name: col.name,
            position: col.position,
          },
          tx,
        );
        columnMap.set(col.name, column.id);
      }

      for (const task of data.tasks) {
        const columnId = columnMap.get(task.columnName);
        if (!columnId) continue;
        await this.tasksRepo.create(
          {
            boardId: created.id,
            workspaceId,
            columnId,
            title: task.title,
            description: task.description ?? null,
            position: task.position,
            priority: task.priority as TaskPriority,
            createdById: userId,
          },
          tx,
        );
      }

      return created;
    });

    return board;
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
      throw new BoardsException(
        BoardsErrorCode.NOT_A_MEMBER,
        'You are not a member of this workspace.',
      );
    }

    if (!this.policy.isAtLeast(membership.role, minimumRole)) {
      throw new BoardsException(
        BoardsErrorCode.INSUFFICIENT_ROLE,
        `Requires ${minimumRole} role or higher.`,
      );
    }
  }
}
