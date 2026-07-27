import { Test, TestingModule } from '@nestjs/testing';

import {
  DATABASE,
  type TaskRow,
  type BoardColumnRow,
  type WorkspaceMemberRow,
} from '@repo/database';

import { TaskPolicy } from '../policies/task.policy';
import { TasksRepository } from '../repositories/tasks.repository';
import { TasksEventBus } from '../events/tasks.events';
import { TasksService } from './tasks.service';

const mockTask: TaskRow = {
  id: 't1',
  workspaceId: 'w1',
  boardId: 'b1',
  columnId: 'c1',
  title: 'Set up CI/CD',
  description: null,
  position: 0,
  status: 'TODO',
  priority: 'HIGH',
  assigneeId: null,
  createdById: 'u1',
  dueDate: null,
  completedAt: null,
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

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepo: jest.Mocked<TasksRepository>;
  let policy: jest.Mocked<TaskPolicy>;
  let events: jest.Mocked<TasksEventBus>;

  beforeEach(async () => {
    db = { select: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: DATABASE, useValue: db },
        {
          provide: TasksRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            listByBoard: jest.fn(),
            listByColumn: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            findColumnById: jest.fn(),
          },
        },
        {
          provide: TaskPolicy,
          useValue: {
            canManage: jest.fn(),
            canEdit: jest.fn(),
            canView: jest.fn(),
            isAtLeast: jest.fn(),
            rank: jest.fn(),
          },
        },
        {
          provide: TasksEventBus,
          useValue: {
            publishTaskCreated: jest.fn(),
            publishTaskUpdated: jest.fn(),
            publishTaskMoved: jest.fn(),
            publishTaskDeleted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    tasksRepo = module.get(TasksRepository);
    policy = module.get(TaskPolicy);
    events = module.get(TasksEventBus);
  });

  describe('create', () => {
    it('creates a task in a column', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue(mockColumn);
      tasksRepo.create.mockResolvedValue(mockTask);

      const result = await service.create('c1', 'b1', 'w1', 'u1', {
        title: 'Set up CI/CD',
        priority: 'HIGH',
      });

      expect(result.id).toBe('t1');
      expect(tasksRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'w1',
          boardId: 'b1',
          columnId: 'c1',
          title: 'Set up CI/CD',
          createdById: 'u1',
        }),
      );
      expect(events.publishTaskCreated).toHaveBeenCalledWith({
        taskId: 't1',
        boardId: 'b1',
        columnId: 'c1',
        createdBy: 'u1',
      });
    });

    it('throws when user is not a member', async () => {
      mockDbSelect([]);

      await expect(
        service.create('c1', 'b1', 'w1', 'u3', { title: 'Task' }),
      ).rejects.toThrow('not a member');
    });

    it('throws when column not found', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue(undefined);

      await expect(
        service.create('c1', 'b1', 'w1', 'u1', { title: 'Task' }),
      ).rejects.toThrow('Column not found');
    });
  });

  describe('getById', () => {
    it('returns task when found', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);

      const result = await service.getById('t1');
      expect(result.id).toBe('t1');
    });

    it('throws when missing', async () => {
      tasksRepo.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing')).rejects.toThrow(
        'Task not found.',
      );
    });
  });

  describe('listByBoard', () => {
    it('returns tasks for board', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.listByBoard.mockResolvedValue([mockTask]);

      const result = await service.listByBoard('b1', 'w1', 'u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('listByColumn', () => {
    it('returns tasks for column', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.listByColumn.mockResolvedValue([mockTask]);

      const result = await service.listByColumn('c1', 'b1', 'w1', 'u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates a task', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.update.mockResolvedValue({ ...mockTask, title: 'Updated' });

      const result = await service.update('t1', 'u1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
      expect(events.publishTaskUpdated).toHaveBeenCalled();
    });

    it('sets completedAt when status changes to DONE', async () => {
      const doneDate = new Date();
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.update.mockResolvedValue({
        ...mockTask,
        status: 'DONE',
        completedAt: doneDate,
      });

      const result = await service.update('t1', 'u1', { status: 'DONE' });

      expect(result.completedAt).toEqual(doneDate);
      expect(tasksRepo.update).toHaveBeenCalled();
    });

    it('clears completedAt when moving away from DONE', async () => {
      tasksRepo.findById.mockResolvedValue({
        ...mockTask,
        status: 'DONE',
        completedAt: new Date(),
      });
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.update.mockResolvedValue({
        ...mockTask,
        status: 'TODO',
        completedAt: null,
      });

      const result = await service.update('t1', 'u1', { status: 'TODO' });

      expect(result.completedAt).toBeNull();
      expect(tasksRepo.update).toHaveBeenCalled();
    });
  });

  describe('move', () => {
    it('moves task to another column', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue({ ...mockColumn, id: 'c2' });
      tasksRepo.update.mockResolvedValue({ ...mockTask, columnId: 'c2' });

      const result = await service.move('t1', 'u1', 'c2');

      expect(result.columnId).toBe('c2');
      expect(events.publishTaskMoved).toHaveBeenCalledWith({
        taskId: 't1',
        fromColumnId: 'c1',
        toColumnId: 'c2',
        movedBy: 'u1',
      });
    });

    it('throws when target column not found', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue(undefined);

      await expect(service.move('t1', 'u1', 'missing')).rejects.toThrow(
        'Target column not found',
      );
    });
  });

  describe('delete', () => {
    it('soft-deletes a task', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);

      await service.delete('t1', 'u1');
      expect(tasksRepo.softDelete).toHaveBeenCalledWith('t1');
      expect(events.publishTaskDeleted).toHaveBeenCalled();
    });
  });
});
