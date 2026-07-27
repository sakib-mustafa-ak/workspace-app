import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type CommentCreatedPayload = {
  commentId: string;
  boardId: string;
  userId: string;
  parentId?: string;
};

export type CommentUpdatedPayload = {
  commentId: string;
  boardId: string;
  userId: string;
};

export type CommentDeletedPayload = {
  commentId: string;
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

  publishCommentDeleted(payload: CommentDeletedPayload): void {
    this.emit(COMMENTS_EVENTS.commentDeleted, payload);
  }

  private emit(name: CommentsEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
