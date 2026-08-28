import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { CommentsEventBus } from '../../comments/events/comments.events';

@Injectable()
export class CommentAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CommentsEventBus) private readonly events: CommentsEventBus,
  ) {}

  onModuleInit() {
    this.events.onCommentCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'comment.created',
        resourceType: 'comment',
        resourceId: p.commentId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onCommentUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'comment.updated',
        resourceType: 'comment',
        resourceId: p.commentId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onCommentDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'comment.deleted',
        resourceType: 'comment',
        resourceId: p.commentId,
        metadata: { boardId: p.boardId },
      });
    });
  }
}
