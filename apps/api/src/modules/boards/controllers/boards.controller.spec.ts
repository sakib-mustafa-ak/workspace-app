import { Test, TestingModule } from '@nestjs/testing';
import type { BoardRow, BoardColumnRow } from '@repo/database';

import { BoardsService } from '../services/boards.service';
import { BoardsController } from './boards.controller';

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

const mockColumn: BoardColumnRow = {
  id: 'c1',
  boardId: 'b1',
  name: 'To Do',
  position: 0,
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('BoardsController', () => {
  let controller: BoardsController;
  let boardsService: jest.Mocked<BoardsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardsController],
      providers: [
        {
          provide: BoardsService,
          useValue: {
            create: jest.fn(),
            getById: jest.fn(),
            listByWorkspace: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            unarchive: jest.fn(),
            delete: jest.fn(),
            getColumns: jest.fn(),
            createColumn: jest.fn(),
            updateColumn: jest.fn(),
            archiveColumn: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BoardsController>(BoardsController);
    boardsService = module.get(BoardsService);
  });

  const currentUser = { id: 'u1', email: 'test@test.com' };

  describe('create', () => {
    it('creates a board', async () => {
      boardsService.create.mockResolvedValue(mockBoard);

      const result = await controller.create(currentUser as never, 'w1', {
        name: 'Sprint 24',
      });

      expect(result.id).toBe('b1');
      expect(result.name).toBe('Sprint 24');
      expect(boardsService.create).toHaveBeenCalledWith('w1', 'u1', {
        name: 'Sprint 24',
      });
    });
  });

  describe('list', () => {
    it('returns boards', async () => {
      boardsService.listByWorkspace.mockResolvedValue([mockBoard]);

      const result = await controller.list(currentUser as never, 'w1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b1');
    });
  });

  describe('getById', () => {
    it('passes workspace and user through to the service', async () => {
      boardsService.getById.mockResolvedValue(mockBoard);

      const result = await controller.getById(currentUser as never, 'w1', 'b1');

      expect(result.id).toBe('b1');
      expect(boardsService.getById).toHaveBeenCalledWith('w1', 'u1', 'b1');
    });
  });

  describe('update', () => {
    it('updates a board', async () => {
      boardsService.update.mockResolvedValue({ ...mockBoard, name: 'Updated' });

      const result = await controller.update(currentUser as never, 'b1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });
  });

  describe('archive', () => {
    it('archives a board', async () => {
      await controller.archive(currentUser as never, 'b1');
      expect(boardsService.archive).toHaveBeenCalledWith('b1', 'u1');
    });
  });

  describe('unarchive', () => {
    it('unarchives a board', async () => {
      await controller.unarchive(currentUser as never, 'b1');
      expect(boardsService.unarchive).toHaveBeenCalledWith('b1', 'u1');
    });
  });

  describe('delete', () => {
    it('soft-deletes a board', async () => {
      await controller.delete(currentUser as never, 'b1');
      expect(boardsService.delete).toHaveBeenCalledWith('b1', 'u1');
    });
  });

  describe('columns', () => {
    it('lists columns', async () => {
      boardsService.getColumns.mockResolvedValue([mockColumn]);

      const result = await controller.getColumns(currentUser as never, 'b1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('To Do');
    });

    it('creates a column', async () => {
      boardsService.createColumn.mockResolvedValue(mockColumn);

      const result = await controller.createColumn(currentUser as never, 'b1', {
        name: 'To Do',
      });

      expect(result.id).toBe('c1');
    });

    it('updates a column', async () => {
      boardsService.updateColumn.mockResolvedValue({
        ...mockColumn,
        name: 'Updated',
      });

      const result = await controller.updateColumn(currentUser as never, 'c1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('archives a column', async () => {
      await controller.archiveColumn(currentUser as never, 'c1');
      expect(boardsService.archiveColumn).toHaveBeenCalledWith('c1', 'u1');
    });
  });
});
