import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type BoardCreatedPayload = {
  boardId: string;
  workspaceId: string;
  createdBy: string;
};

export type BoardUpdatedPayload = {
  boardId: string;
  workspaceId: string;
  updatedBy: string;
};

export type BoardArchivedPayload = {
  boardId: string;
  workspaceId: string;
  archivedBy: string;
};

export type BoardDeletedPayload = {
  boardId: string;
  workspaceId: string;
  deletedBy: string;
};

export type ColumnCreatedPayload = {
  columnId: string;
  boardId: string;
  workspaceId: string;
  createdBy: string;
};

export type ColumnUpdatedPayload = {
  columnId: string;
  boardId: string;
  workspaceId: string;
  updatedBy: string;
};

export type ColumnArchivedPayload = {
  columnId: string;
  boardId: string;
  workspaceId: string;
  archivedBy: string;
};

export const BOARDS_EVENTS = {
  boardCreated: 'BoardCreated',
  boardUpdated: 'BoardUpdated',
  boardArchived: 'BoardArchived',
  boardDeleted: 'BoardDeleted',
  columnCreated: 'ColumnCreated',
  columnUpdated: 'ColumnUpdated',
  columnArchived: 'ColumnArchived',
} as const;

export type BoardsEventName =
  (typeof BOARDS_EVENTS)[keyof typeof BOARDS_EVENTS];

@Injectable()
export class BoardsEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishBoardCreated(payload: BoardCreatedPayload): void {
    this.emit(BOARDS_EVENTS.boardCreated, payload);
  }

  onBoardCreated(listener: (payload: BoardCreatedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.boardCreated, listener);
  }

  onBoardUpdated(listener: (payload: BoardUpdatedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.boardUpdated, listener);
  }

  publishBoardUpdated(payload: BoardUpdatedPayload): void {
    this.emit(BOARDS_EVENTS.boardUpdated, payload);
  }

  publishBoardArchived(payload: BoardArchivedPayload): void {
    this.emit(BOARDS_EVENTS.boardArchived, payload);
  }

  onBoardArchived(listener: (payload: BoardArchivedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.boardArchived, listener);
  }

  publishBoardDeleted(payload: BoardDeletedPayload): void {
    this.emit(BOARDS_EVENTS.boardDeleted, payload);
  }

  onBoardDeleted(listener: (payload: BoardDeletedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.boardDeleted, listener);
  }

  publishColumnCreated(payload: ColumnCreatedPayload): void {
    this.emit(BOARDS_EVENTS.columnCreated, payload);
  }

  onColumnCreated(listener: (payload: ColumnCreatedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.columnCreated, listener);
  }

  publishColumnUpdated(payload: ColumnUpdatedPayload): void {
    this.emit(BOARDS_EVENTS.columnUpdated, payload);
  }

  onColumnUpdated(listener: (payload: ColumnUpdatedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.columnUpdated, listener);
  }

  publishColumnArchived(payload: ColumnArchivedPayload): void {
    this.emit(BOARDS_EVENTS.columnArchived, payload);
  }

  onColumnArchived(listener: (payload: ColumnArchivedPayload) => void): void {
    this.emitter.on(BOARDS_EVENTS.columnArchived, listener);
  }

  private emit(name: BoardsEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
