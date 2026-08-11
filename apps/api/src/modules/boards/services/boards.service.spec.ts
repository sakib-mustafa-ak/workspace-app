import { Test, TestingModule } from '@nestjs/testing';

import {
  DATABASE,
  type BoardRow,
  type BoardColumnRow,
  type WorkspaceMemberRow,
} from '@repo/database';

import { BoardPolicy } from '../policies/board.policy';
import { BoardsRepository } from '../repositories/boards.repository';
import { BoardColumnsRepository } from '../repositories/board-columns.repository';
import { BoardsEventBus } from '../events/boards.events';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import { BoardsService } from './boards.service';

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

const mockArchivedBoard: BoardRow = {
  ...mockBoard,
  id: 'b2',
  status: 'ARCHIVED',
  archivedAt: new Date(),
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

const mockAdminMembership: WorkspaceMemberRow = {
  ...mockMembership,
  userId: 'u2',
  role: 'ADMIN',
};

function mockDbSelect(resolved: unknown[]): void {
  db.select = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(resolved),
      }),
    }),
  });
}

let db: { transaction: jest.Mock; insert: jest.Mock; select: jest.Mock };

describe('BoardsService', () => {
  let service: BoardsService;
  let boardsRepo: jest.Mocked<BoardsRepository>;
  let columnsRepo: jest.Mocked<BoardColumnsRepository>;
  let policy: jest.Mocked<BoardPolicy>;
  let events: jest.Mocked<BoardsEventBus>;

  beforeEach(async () => {
    db = {
      transaction: jest.fn(),
      insert: jest.fn(),
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: DATABASE, useValue: db },
        {
          provide: BoardsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            listByWorkspace: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            unarchive: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: BoardColumnsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            listByBoard: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
          },
        },
        {
          provide: BoardPolicy,
          useValue: {
            canManage: jest.fn(),
            canEdit: jest.fn(),
            canView: jest.fn(),
            isAtLeast: jest.fn(),
            rank: jest.fn(),
          },
        },
        {
          provide: BoardsEventBus,
          useValue: {
            publishBoardCreated: jest.fn(),
            publishBoardUpdated: jest.fn(),
            publishBoardArchived: jest.fn(),
            publishBoardDeleted: jest.fn(),
            publishColumnCreated: jest.fn(),
            publishColumnUpdated: jest.fn(),
            publishColumnArchived: jest.fn(),
          },
        },
        {
          provide: TasksRepository,
          useValue: {
            countByBoard: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BoardsService>(BoardsService);
    boardsRepo = module.get(BoardsRepository);
    columnsRepo = module.get(BoardColumnsRepository);
    policy = module.get(BoardPolicy);
    events = module.get(BoardsEventBus);
  });

  describe('create', () => {
    it('creates a board with default columns', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      boardsRepo.create.mockResolvedValue(mockBoard);
      columnsRepo.create.mockResolvedValue(mockColumn);

      const result = await service.create('w1', 'u1', {
        name: 'Sprint 24',
      });

      expect(result.id).toBe('b1');
      expect(boardsRepo.create).toHaveBeenCalledWith({
        workspaceId: 'w1',
        name: 'Sprint 24',
        description: null,
        position: 0,
      });
      expect(events.publishBoardCreated).toHaveBeenCalledWith({
        boardId: 'b1',
        workspaceId: 'w1',
        createdBy: 'u1',
      });
    });

    it('throws when user is not a member', async () => {
      mockDbSelect([]);

      await expect(
        service.create('w1', 'u3', { name: 'Board' }),
      ).rejects.toThrow('not a member');
    });

    it('throws when user lacks sufficient role', async () => {
      mockDbSelect([{ ...mockMembership, role: 'VIEWER' }]);
      policy.isAtLeast.mockReturnValue(false);

      await expect(
        service.create('w1', 'u1', { name: 'Board' }),
      ).rejects.toThrow('Requires EDITOR role');
    });
  });

  describe('getById', () => {
    it('returns board when found', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);

      const result = await service.getById('b1');
      expect(result.id).toBe('b1');
    });

    it('throws when missing', async () => {
      boardsRepo.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing')).rejects.toThrow(
        'Board not found.',
      );
    });
  });

  describe('listByWorkspace', () => {
    it('returns boards for workspace', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      boardsRepo.listByWorkspace.mockResolvedValue([mockBoard]);

      const result = await service.listByWorkspace('w1', 'u1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b1');
    });
  });

  describe('update', () => {
    it('updates board with EDITOR role', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      boardsRepo.update.mockResolvedValue({ ...mockBoard, name: 'Updated' });

      const result = await service.update('b1', 'u1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(events.publishBoardUpdated).toHaveBeenCalled();
    });

    it('throws when board is archived', async () => {
      boardsRepo.findById.mockResolvedValue(mockArchivedBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);

      await expect(service.update('b2', 'u2', { name: 'X' })).rejects.toThrow(
        'Cannot update an archived board',
      );
    });
  });

  describe('archive / unarchive / delete', () => {
    it('archives with ADMIN role', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockAdminMembership]);
      policy.isAtLeast.mockReturnValue(true);

      await service.archive('b1', 'u2');
      expect(boardsRepo.archive).toHaveBeenCalledWith('b1');
      expect(events.publishBoardArchived).toHaveBeenCalled();
    });

    it('unarchives with OWNER role', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([{ ...mockMembership, role: 'OWNER' }]);
      policy.isAtLeast.mockReturnValue(true);

      await service.unarchive('b1', 'u1');
      expect(boardsRepo.unarchive).toHaveBeenCalledWith('b1');
    });

    it('soft-deletes and publishes event', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockAdminMembership]);
      policy.isAtLeast.mockReturnValue(true);

      await service.delete('b1', 'u2');
      expect(boardsRepo.softDelete).toHaveBeenCalledWith('b1');
      expect(events.publishBoardDeleted).toHaveBeenCalled();
    });
  });

  describe('columns', () => {
    it('returns columns for a board', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      columnsRepo.listByBoard.mockResolvedValue([mockColumn]);

      const result = await service.getColumns('b1', 'u1');
      expect(result).toHaveLength(1);
    });

    it('creates a column', async () => {
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      columnsRepo.listByBoard.mockResolvedValue([mockColumn]);
      columnsRepo.create.mockResolvedValue(mockColumn);

      const result = await service.createColumn('b1', 'u1', { name: 'To Do' });
      expect(result.id).toBe('c1');
      expect(columnsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ position: 1 }),
      );
      expect(events.publishColumnCreated).toHaveBeenCalled();
    });

    it('throws creating column in archived board', async () => {
      boardsRepo.findById.mockResolvedValue(mockArchivedBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);

      await expect(
        service.createColumn('b2', 'u2', { name: 'New Col' }),
      ).rejects.toThrow('Cannot add columns to an archived board');
    });

    it('updates a column', async () => {
      columnsRepo.findById.mockResolvedValue(mockColumn);
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      columnsRepo.update.mockResolvedValue({ ...mockColumn, name: 'Updated' });

      const result = await service.updateColumn('c1', 'u1', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
      expect(events.publishColumnUpdated).toHaveBeenCalled();
    });

    it('archives a column', async () => {
      columnsRepo.findById.mockResolvedValue(mockColumn);
      boardsRepo.findById.mockResolvedValue(mockBoard);
      mockDbSelect([mockAdminMembership]);
      policy.isAtLeast.mockReturnValue(true);

      await service.archiveColumn('c1', 'u2');
      expect(columnsRepo.archive).toHaveBeenCalledWith('c1');
      expect(events.publishColumnArchived).toHaveBeenCalled();
    });
  });
});
