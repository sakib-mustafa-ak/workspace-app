import { Test, TestingModule } from '@nestjs/testing';
import type { BoardCommentRow } from '@repo/database';

import { CommentsService } from '../services/comments.service';
import { CommentsController } from './comments.controller';

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

describe('CommentsController', () => {
  let controller: CommentsController;
  let commentsService: jest.Mocked<CommentsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: {
            create: jest.fn(),
            listByBoard: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    commentsService = module.get(CommentsService);
  });

  const currentUser = { id: 'u1', email: 'test@test.com' };

  describe('create', () => {
    it('creates a comment', async () => {
      commentsService.create.mockResolvedValue(mockComment);

      const result = await controller.create(currentUser as never, 'b1', {
        content: 'Great idea!',
      });

      expect(result.id).toBe('c1');
      expect(commentsService.create).toHaveBeenCalledWith('b1', 'u1', {
        content: 'Great idea!',
      });
    });
  });

  describe('list', () => {
    it('lists comments', async () => {
      commentsService.listByBoard.mockResolvedValue([mockComment]);

      const result = await controller.list(currentUser as never, 'b1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('returns a comment', async () => {
      commentsService.getById.mockResolvedValue(mockComment);

      const result = await controller.getById({ id: 'u1' } as never, 'c1');
      expect(result.id).toBe('c1');
    });
  });

  describe('update', () => {
    it('updates a comment', async () => {
      commentsService.update.mockResolvedValue({
        ...mockComment,
        content: 'Updated!',
        editedAt: new Date(),
      });

      const result = await controller.update(currentUser as never, 'c1', {
        content: 'Updated!',
      });

      expect(result.content).toBe('Updated!');
    });
  });

  describe('delete', () => {
    it('soft-deletes a comment', async () => {
      await controller.delete(currentUser as never, 'c1');
      expect(commentsService.delete).toHaveBeenCalledWith('c1', 'u1');
    });
  });
});
