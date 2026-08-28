import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type CommentCreatedPayload = {
  commentId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
  parentId?: string;
};

export type CommentUpdatedPayload = {
  commentId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
};

export type CommentDeletedPayload = {
  commentId: string;
  workspaceId: string;
  boardId: string;
  deletedBy: string;
};

export const COMMENTS_EVENTS = {
  commentCreated: 'CommentCreated',
  commentUpdated: 'CommentUpdated',
  commentDeleted: 'CommentDeleted',
} as const;

export type CommentsEventName =
  (typeof COMMENTS_EVENTS)[keyof typeof COMMENTS_EVENTS];

@Injectable()
export class CommentsEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishCommentCreated(payload: CommentCreatedPayload): void {
    this.emit(COMMENTS_EVENTS.commentCreated, payload);
  }

  onCommentCreated(listener: (payload: CommentCreatedPayload) => void): void {
    this.emitter.on(COMMENTS_EVENTS.commentCreated, listener);
  }

  publishCommentUpdated(payload: CommentUpdatedPayload): void {
    this.emit(COMMENTS_EVENTS.commentUpdated, payload);
  }

  onCommentUpdated(listener: (payload: CommentUpdatedPayload) => void): void {
    this.emitter.on(COMMENTS_EVENTS.commentUpdated, listener);
  }

  publishCommentDeleted(payload: CommentDeletedPayload): void {
    this.emit(COMMENTS_EVENTS.commentDeleted, payload);
  }

  onCommentDeleted(listener: (payload: CommentDeletedPayload) => void): void {
    this.emitter.on(COMMENTS_EVENTS.commentDeleted, listener);
  }

  private emit(name: CommentsEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
