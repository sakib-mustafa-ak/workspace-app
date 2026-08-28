import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type FileUploadedPayload = {
  fileId: string;
  workspaceId: string;
  boardId?: string;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type FileDeletedPayload = {
  fileId: string;
  workspaceId: string;
  deletedBy: string;
};

export const UPLOADS_EVENTS = {
  fileUploaded: 'FileUploaded',
  fileDeleted: 'FileDeleted',
} as const;

export type UploadsEventName =
  (typeof UPLOADS_EVENTS)[keyof typeof UPLOADS_EVENTS];

@Injectable()
export class UploadsEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishFileUploaded(payload: FileUploadedPayload): void {
    this.emit(UPLOADS_EVENTS.fileUploaded, payload);
  }

  onFileUploaded(listener: (payload: FileUploadedPayload) => void): void {
    this.emitter.on(UPLOADS_EVENTS.fileUploaded, listener);
  }

  publishFileDeleted(payload: FileDeletedPayload): void {
    this.emit(UPLOADS_EVENTS.fileDeleted, payload);
  }

  onFileDeleted(listener: (payload: FileDeletedPayload) => void): void {
    this.emitter.on(UPLOADS_EVENTS.fileDeleted, listener);
  }

  private emit(name: UploadsEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
