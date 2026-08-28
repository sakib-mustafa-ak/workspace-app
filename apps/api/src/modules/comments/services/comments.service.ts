import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  type BoardCommentRow,
  type Db,
  type WorkspaceRole,
  workspaceMembers,
} from '@repo/database';

import {
  CommentsErrorCode,
  CommentsException,
} from '../errors/comments.errors';
import { CommentPolicy } from '../policies/comment.policy';
import { CommentsRepository } from '../repositories/comments.repository';
import { CommentsEventBus } from '../events/comments.events';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(CommentsRepository)
    private readonly commentsRepo: CommentsRepository,
    @Inject(CommentPolicy) private readonly policy: CommentPolicy,
    @Inject(CommentsEventBus) private readonly events: CommentsEventBus,
  ) {}

  public async create(
    boardId: string,
    userId: string,
    input: { content: string; parentId?: string },
  ): Promise<BoardCommentRow> {
    const board = await this.commentsRepo.findBoardById(boardId);
    if (!board) {
      throw new CommentsException(
        CommentsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    await this.requireRole(board.workspaceId, userId, 'COMMENTER');

    if (input.parentId) {
      const parent = await this.commentsRepo.findById(input.parentId);
      if (!parent) {
        throw new CommentsException(
          CommentsErrorCode.COMMENT_NOT_FOUND,
          'Parent comment not found.',
        );
      }
    }

    const comment = await this.commentsRepo.create({
      boardId,
      workspaceId: board.workspaceId,
      content: input.content,
      userId,
      parentId: input.parentId ?? null,
    });

    this.events.publishCommentCreated({
      commentId: comment.id,
      workspaceId: board.workspaceId,
      boardId,
      userId,
      parentId: input.parentId,
    });

    return comment;
  }

  public async listByBoard(
    boardId: string,
    userId: string,
  ): Promise<
    Array<
      BoardCommentRow & {
        author: { displayName: string; avatarUrl: string | null } | null;
      }
    >
  > {
    const board = await this.commentsRepo.findBoardById(boardId);
    if (!board) {
      throw new CommentsException(
        CommentsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }
    await this.requireRole(board.workspaceId, userId, 'VIEWER');
    return this.commentsRepo.findByBoardWithAuthor(boardId);
  }

  public async getById(
    commentId: string,
    userId: string,
  ): Promise<BoardCommentRow> {
    const comment = await this.commentsRepo.findById(commentId);
    if (!comment) {
      throw new CommentsException(
        CommentsErrorCode.COMMENT_NOT_FOUND,
        'Comment not found.',
      );
    }
    // Comments are private to their workspace — non-members must not read
    // arbitrary comments by id.
    await this.requireRole(comment.workspaceId, userId, 'VIEWER');
    return comment;
  }

  public async update(
    commentId: string,
    userId: string,
    input: { content: string },
  ): Promise<BoardCommentRow> {
    const comment = await this.commentsRepo.findById(commentId);
    if (!comment) {
      throw new CommentsException(
        CommentsErrorCode.COMMENT_NOT_FOUND,
        'Comment not found.',
      );
    }

    const board = await this.commentsRepo.findBoardById(comment.boardId);
    if (!board) {
      throw new CommentsException(
        CommentsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    const membership = await this.getMembership(board.workspaceId, userId);
    const isOwner = comment.userId === userId;

    if (
      !this.policy.canEditComment(membership.role as WorkspaceRole, isOwner)
    ) {
      throw new CommentsException(
        CommentsErrorCode.CANNOT_EDIT,
        'You can only edit your own comments.',
      );
    }

    const updated = await this.commentsRepo.update(commentId, input);
    this.events.publishCommentUpdated({
      commentId,
      workspaceId: board.workspaceId,
      boardId: comment.boardId,
      userId,
    });

    return updated;
  }

  public async delete(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentsRepo.findById(commentId);
    if (!comment) {
      throw new CommentsException(
        CommentsErrorCode.COMMENT_NOT_FOUND,
        'Comment not found.',
      );
    }

    const board = await this.commentsRepo.findBoardById(comment.boardId);
    if (!board) {
      throw new CommentsException(
        CommentsErrorCode.BOARD_NOT_FOUND,
        'Board not found.',
      );
    }

    const membership = await this.getMembership(board.workspaceId, userId);
    const isOwner = comment.userId === userId;

    if (
      !this.policy.canDeleteComment(membership.role as WorkspaceRole, isOwner)
    ) {
      throw new CommentsException(
        CommentsErrorCode.CANNOT_DELETE,
        'You can only delete your own comments or have ADMIN role.',
      );
    }

    await this.commentsRepo.softDelete(commentId);
    this.events.publishCommentDeleted({
      commentId,
      workspaceId: board.workspaceId,
      boardId: comment.boardId,
      deletedBy: userId,
    });
  }

  private async requireRole(
    workspaceId: string,
    userId: string,
    minimumRole: WorkspaceRole,
  ): Promise<void> {
    const membership = await this.getMembership(workspaceId, userId);

    if (!this.policy.isAtLeast(membership.role as WorkspaceRole, minimumRole)) {
      throw new CommentsException(
        CommentsErrorCode.INSUFFICIENT_ROLE,
        `Requires ${minimumRole} role or higher.`,
      );
    }
  }

  private async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<{ role: string }> {
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
      throw new CommentsException(
        CommentsErrorCode.NOT_A_MEMBER,
        'You are not a member of this workspace.',
      );
    }

    return membership;
  }
}
