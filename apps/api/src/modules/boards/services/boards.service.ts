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

@Injectable()
export class BoardsService {
  private readonly logger = new Logger(BoardsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly boardsRepo: BoardsRepository,
    private readonly columnsRepo: BoardColumnsRepository,
    private readonly policy: BoardPolicy,
    private readonly events: BoardsEventBus,
  ) {}

  public async create(
    workspaceId: string,
    userId: string,
    input: { name: string; description?: string },
  ): Promise<BoardRow> {
    await this.requireRole(workspaceId, userId, 'EDITOR');

    const board = await this.boardsRepo.create({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      position: 0,
    });

    await this.columnsRepo.create({
      boardId: board.id,
      name: 'To Do',
      position: 0,
    });
    await this.columnsRepo.create({
      boardId: board.id,
      name: 'In Progress',
      position: 1,
    });
    await this.columnsRepo.create({
      boardId: board.id,
      name: 'Done',
      position: 2,
    });

    this.events.publishBoardCreated({
      boardId: board.id,
      workspaceId,
      createdBy: userId,
    });

    return board;
  }

  public async getById(boardId: string): Promise<BoardRow> {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) {
      throw new BoardsException(
        BoardsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }
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
    this.events.publishBoardUpdated({ boardId, updatedBy: userId });
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
    this.events.publishBoardArchived({ boardId, archivedBy: userId });
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
    this.events.publishBoardDeleted({ boardId, deletedBy: userId });
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

    const column = await this.columnsRepo.create({
      boardId,
      name: input.name,
      position: input.position ?? 0,
    });

    this.events.publishColumnCreated({
      columnId: column.id,
      boardId,
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
      archivedBy: userId,
    });
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
