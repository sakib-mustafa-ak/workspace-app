import { Test, TestingModule } from '@nestjs/testing';

import {
  DATABASE,
  type BoardCommentRow,
  type BoardRow,
  type WorkspaceMemberRow,
} from '@repo/database';

import { CommentPolicy } from '../policies/comment.policy';
import { CommentsRepository } from '../repositories/comments.repository';
import { CommentsEventBus } from '../events/comments.events';
import { CommentsService } from './comments.service';

const mockBoard: BoardRow = {
  id: 'b1',
  workspaceId: 'w1',
  name: 'Sprint 24',
  description: null,
  position: 0,
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockComment: BoardCommentRow = {
  id: 'c1',
  boardId: 'b1',
  workspaceId: 'w1',
  parentId: null,
  content: 'Great idea!',
  userId: 'u1',
  editedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockReply: BoardCommentRow = {
  ...mockComment,
  id: 'c2',
  parentId: 'c1',
  content: 'Thanks!',
  userId: 'u2',
};

const mockMembership: WorkspaceMemberRow = {
  id: 'm1',
  workspaceId: 'w1',
  userId: 'u1',
  role: 'EDITOR',
  status: 'ACTIVE',
  joinedAt: new Date(),
  deletedAt: null,
  invitationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let db: { select: jest.Mock };

function mockDbSelect(resolved: unknown[]): void {
  db.select = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(resolved),
      }),
    }),
  });
}

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepo: jest.Mocked<CommentsRepository>;
  let policy: jest.Mocked<CommentPolicy>;
  let events: jest.Mocked<CommentsEventBus>;

  beforeEach(async () => {
    db = { select: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: DATABASE, useValue: db },
        {
          provide: CommentsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByBoard: jest.fn(),
            findByBoardWithAuthor: jest.fn(),
            findReplies: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            findBoardById: jest.fn(),
          },
        },
        {
          provide: CommentPolicy,
          useValue: {
            canManage: jest.fn(),
            canComment: jest.fn(),
            canView: jest.fn(),
            isAtLeast: jest.fn(),
            canDeleteComment: jest.fn(),
            canEditComment: jest.fn(),
          },
        },
        {
          provide: CommentsEventBus,
          useValue: {
            publishCommentCreated: jest.fn(),
            publishCommentUpdated: jest.fn(),
            publishCommentDeleted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    commentsRepo = module.get(CommentsRepository);
    policy = module.get(CommentPolicy);
    events = module.get(CommentsEventBus);
  });

  describe('create', () => {
    it('creates a comment on a board', async () => {
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      commentsRepo.create.mockResolvedValue(mockComment);

      const result = await service.create('b1', 'u1', {
        content: 'Great idea!',
      });

      expect(result.id).toBe('c1');
      expect(commentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          boardId: 'b1',
          workspaceId: 'w1',
          content: 'Great idea!',
          userId: 'u1',
        }),
      );
      expect(events.publishCommentCreated).toHaveBeenCalledWith({
        commentId: 'c1',
        workspaceId: 'w1',
        boardId: 'b1',
        userId: 'u1',
        parentId: undefined,
      });
    });

    it('throws when board not found', async () => {
      commentsRepo.findBoardById.mockResolvedValue(undefined);

      await expect(
        service.create('missing', 'u1', { content: 'Test' }),
      ).rejects.toThrow('Board not found');
    });

    it('throws when parent comment not found', async () => {
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      commentsRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.create('b1', 'u1', { content: 'Reply', parentId: 'missing' }),
      ).rejects.toThrow('Parent comment not found');
    });

    it('creates a threaded reply', async () => {
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      commentsRepo.findById.mockResolvedValue(mockComment);
      commentsRepo.create.mockResolvedValue(mockReply);

      const result = await service.create('b1', 'u2', {
        content: 'Thanks!',
        parentId: 'c1',
      });

      expect(result.parentId).toBe('c1');
    });
  });

  describe('listByBoard', () => {
    it('lists comments', async () => {
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      commentsRepo.findByBoardWithAuthor.mockResolvedValue([
        mockComment,
        mockReply,
      ]);

      const result = await service.listByBoard('b1', 'u1');

      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates own comment', async () => {
      commentsRepo.findById.mockResolvedValue(mockComment);
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.canEditComment.mockReturnValue(true);
      commentsRepo.update.mockResolvedValue({
        ...mockComment,
        content: 'Updated!',
        editedAt: new Date(),
      });

      const result = await service.update('c1', 'u1', {
        content: 'Updated!',
      });

      expect(result.content).toBe('Updated!');
      expect(events.publishCommentUpdated).toHaveBeenCalled();
    });

    it('throws when editing another user comment', async () => {
      commentsRepo.findById.mockResolvedValue(mockComment);
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.canEditComment.mockReturnValue(false);

      await expect(
        service.update('c1', 'u2', { content: 'Hacked!' }),
      ).rejects.toThrow('You can only edit your own comments');
    });
  });

  describe('delete', () => {
    it('deletes own comment', async () => {
      commentsRepo.findById.mockResolvedValue(mockComment);
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.canDeleteComment.mockReturnValue(true);

      await service.delete('c1', 'u1');
      expect(commentsRepo.softDelete).toHaveBeenCalledWith('c1');
      expect(events.publishCommentDeleted).toHaveBeenCalled();
    });

    it('throws when not owner and not admin', async () => {
      commentsRepo.findById.mockResolvedValue(mockComment);
      commentsRepo.findBoardById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.canDeleteComment.mockReturnValue(false);

      await expect(service.delete('c1', 'u2')).rejects.toThrow(
        'can only delete your own comments',
      );
    });
  });
});
