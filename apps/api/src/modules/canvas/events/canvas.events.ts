import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type ObjectCreatedPayload = {
  objectId: string;
  canvasId: string;
  boardId: string;
  userId: string;
  type: string;
};

export type ObjectUpdatedPayload = {
  objectId: string;
  canvasId: string;
  boardId: string;
  userId: string;
};

export type ObjectDeletedPayload = {
  objectId: string;
  canvasId: string;
  boardId: string;
  deletedBy: string;
};

export const CANVAS_EVENTS = {
  objectCreated: 'CanvasObjectCreated',
  objectUpdated: 'CanvasObjectUpdated',
  objectDeleted: 'CanvasObjectDeleted',
} as const;

export type CanvasEventName =
  (typeof CANVAS_EVENTS)[keyof typeof CANVAS_EVENTS];

@Injectable()
export class CanvasEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishObjectCreated(payload: ObjectCreatedPayload): void {
    this.emit(CANVAS_EVENTS.objectCreated, payload);
  }

  onObjectCreated(listener: (payload: ObjectCreatedPayload) => void): void {
    this.emitter.on(CANVAS_EVENTS.objectCreated, listener);
  }

  onObjectUpdated(listener: (payload: ObjectUpdatedPayload) => void): void {
    this.emitter.on(CANVAS_EVENTS.objectUpdated, listener);
  }

  publishObjectUpdated(payload: ObjectUpdatedPayload): void {
    this.emit(CANVAS_EVENTS.objectUpdated, payload);
  }

  onObjectDeleted(listener: (payload: ObjectDeletedPayload) => void): void {
    this.emitter.on(CANVAS_EVENTS.objectDeleted, listener);
  }

  publishObjectDeleted(payload: ObjectDeletedPayload): void {
    this.emit(CANVAS_EVENTS.objectDeleted, payload);
  }

  private emit(name: CanvasEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
