import { Test, TestingModule } from '@nestjs/testing';

import { CommentAuditHandler } from './comment-audit.handler';
import { AuditService } from '../services/audit.service';
import { CommentsEventBus } from '../../comments/events/comments.events';

describe('CommentAuditHandler', () => {
  let handler: CommentAuditHandler;
  let audit: { record: jest.Mock };
  let bus: CommentsEventBus;

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentAuditHandler,
        CommentsEventBus,
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    handler = module.get(CommentAuditHandler);
    bus = module.get(CommentsEventBus);
    handler.onModuleInit();
  });

  it('records comment.created via the event bus', () => {
    bus.publishCommentCreated({
      commentId: 'c-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      userId: 'u-1',
      parentId: 'c-0',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'comment.created',
      resourceType: 'comment',
      resourceId: 'c-1',
      metadata: { boardId: 'b-1' },
    });
  });

  it('records comment.updated via the event bus', () => {
    bus.publishCommentUpdated({
      commentId: 'c-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      userId: 'u-1',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'comment.updated',
      resourceType: 'comment',
      resourceId: 'c-1',
      metadata: { boardId: 'b-1' },
    });
  });

  it('records comment.deleted via the event bus', () => {
    bus.publishCommentDeleted({
      commentId: 'c-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      deletedBy: 'u-2',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-2',
      action: 'comment.deleted',
      resourceType: 'comment',
      resourceId: 'c-1',
      metadata: { boardId: 'b-1' },
    });
  });
});
