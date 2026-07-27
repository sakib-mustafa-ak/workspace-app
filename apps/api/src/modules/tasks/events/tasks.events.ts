import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type TaskCreatedPayload = {
  taskId: string;
  boardId: string;
  columnId: string;
  createdBy: string;
};

export type TaskUpdatedPayload = {
  taskId: string;
  updatedBy: string;
};

export type TaskMovedPayload = {
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  movedBy: string;
};

export type TaskDeletedPayload = {
  taskId: string;
  deletedBy: string;
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

  publishTaskMoved(payload: TaskMovedPayload): void {
    this.emit(TASKS_EVENTS.taskMoved, payload);
  }

  publishTaskDeleted(payload: TaskDeletedPayload): void {
    this.emit(TASKS_EVENTS.taskDeleted, payload);
  }

  private emit(name: TasksEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
