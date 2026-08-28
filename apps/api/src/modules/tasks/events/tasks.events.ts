import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type TaskCreatedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  columnId: string;
  createdBy: string;
  assigneeId?: string;
  title: string;
};

export type TaskUpdatedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  updatedBy: string;
  title: string;
  previousAssigneeId: string | null;
  assigneeId: string | null;
};

export type TaskMovedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  fromColumnId: string;
  toColumnId: string;
  movedBy: string;
};

export type TaskDeletedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  deletedBy: string;
  title: string;
  assigneeId: string | null;
};

export const TASKS_EVENTS = {
  taskCreated: 'TaskCreated',
  taskUpdated: 'TaskUpdated',
  taskMoved: 'TaskMoved',
  taskDeleted: 'TaskDeleted',
} as const;

export type TasksEventName = (typeof TASKS_EVENTS)[keyof typeof TASKS_EVENTS];

@Injectable()
export class TasksEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishTaskCreated(payload: TaskCreatedPayload): void {
    this.emit(TASKS_EVENTS.taskCreated, payload);
  }

  onTaskCreated(listener: (payload: TaskCreatedPayload) => void): void {
    this.emitter.on(TASKS_EVENTS.taskCreated, listener);
  }

  publishTaskUpdated(payload: TaskUpdatedPayload): void {
    this.emit(TASKS_EVENTS.taskUpdated, payload);
  }

  onTaskUpdated(listener: (payload: TaskUpdatedPayload) => void): void {
    this.emitter.on(TASKS_EVENTS.taskUpdated, listener);
  }

  publishTaskMoved(payload: TaskMovedPayload): void {
    this.emit(TASKS_EVENTS.taskMoved, payload);
  }

  onTaskMoved(listener: (payload: TaskMovedPayload) => void): void {
    this.emitter.on(TASKS_EVENTS.taskMoved, listener);
  }

  publishTaskDeleted(payload: TaskDeletedPayload): void {
    this.emit(TASKS_EVENTS.taskDeleted, payload);
  }

  onTaskDeleted(listener: (payload: TaskDeletedPayload) => void): void {
    this.emitter.on(TASKS_EVENTS.taskDeleted, listener);
  }

  private emit(name: TasksEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
