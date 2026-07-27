import { Test, TestingModule } from '@nestjs/testing';
import type { TaskRow } from '@repo/database';

import { TasksService } from '../services/tasks.service';
import { TasksController } from './tasks.controller';

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

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: jest.Mocked<TasksService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            create: jest.fn(),
            getById: jest.fn(),
            listByBoard: jest.fn(),
            listByColumn: jest.fn(),
            update: jest.fn(),
            move: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    tasksService = module.get(TasksService);
  });

  const currentUser = { id: 'u1', email: 'test@test.com' };

  describe('create', () => {
    it('creates a task', async () => {
      tasksService.create.mockResolvedValue(mockTask);

      const result = await controller.create(
        currentUser as never,
        'w1',
        'b1',
        'c1',
        { title: 'Set up CI/CD', priority: 'HIGH' as const },
      );

      expect(result.id).toBe('t1');
      expect(tasksService.create).toHaveBeenCalledWith('c1', 'b1', 'w1', 'u1', {
        title: 'Set up CI/CD',
        priority: 'HIGH',
      });
    });
  });

  describe('listByBoard', () => {
    it('returns tasks', async () => {
      tasksService.listByBoard.mockResolvedValue([mockTask]);

      const result = await controller.listByBoard(
        currentUser as never,
        'w1',
        'b1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });
  });

  describe('listByColumn', () => {
    it('returns tasks in column', async () => {
      tasksService.listByColumn.mockResolvedValue([mockTask]);

      const result = await controller.listByColumn(
        currentUser as never,
        'w1',
        'b1',
        'c1',
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('returns a task', async () => {
      tasksService.getById.mockResolvedValue(mockTask);

      const result = await controller.getById('t1');
      expect(result.id).toBe('t1');
    });
  });

  describe('update', () => {
    it('updates a task', async () => {
      tasksService.update.mockResolvedValue({ ...mockTask, title: 'Updated' });

      const result = await controller.update(currentUser as never, 't1', {
        title: 'Updated',
      });

      expect(result.title).toBe('Updated');
    });
  });

  describe('move', () => {
    it('moves a task', async () => {
      tasksService.move.mockResolvedValue({ ...mockTask, columnId: 'c2' });

      const result = await controller.move(currentUser as never, 't1', {
        columnId: 'c2',
      });

      expect(result.columnId).toBe('c2');
      expect(tasksService.move).toHaveBeenCalledWith(
        't1',
        'u1',
        'c2',
        undefined,
      );
    });
  });

  describe('delete', () => {
    it('soft-deletes a task', async () => {
      await controller.delete(currentUser as never, 't1');
      expect(tasksService.delete).toHaveBeenCalledWith('t1', 'u1');
    });
  });
});
