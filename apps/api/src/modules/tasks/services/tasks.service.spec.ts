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

function mockDbSelectSequential(resolved: unknown[][]): void {
  const select = jest.fn();
  for (const rows of resolved) {
    select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }
  db.select = select;
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
            findBoardById: jest.fn(),
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
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);
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
        workspaceId: 'w1',
        boardId: 'b1',
        columnId: 'c1',
        createdBy: 'u1',
        title: 'Set up CI/CD',
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
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);
      tasksRepo.findColumnById.mockResolvedValue(undefined);

      await expect(
        service.create('c1', 'b1', 'w1', 'u1', { title: 'Task' }),
      ).rejects.toThrow('Column not found');
    });

    it('throws when the column belongs to a different board than the path (cross-workspace create)', async () => {
      // Regression: create used to trust the path workspaceId/boardId and
      // the column id independently, letting a task be pinned onto a
      // foreign board's column.
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue({
        ...mockColumn,
        boardId: 'b-foreign',
      });
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);

      await expect(
        service.create('c-foreign', 'b1', 'w1', 'u1', { title: 'Task' }),
      ).rejects.toThrow('Column not found');
      expect(tasksRepo.create).not.toHaveBeenCalled();
    });

    it('throws when the path board does not belong to the path workspace (cross-workspace create)', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue(mockColumn);
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w-other',
      } as never);

      await expect(
        service.create('c1', 'b1', 'w1', 'u1', { title: 'Task' }),
      ).rejects.toThrow('Board not found');
      expect(tasksRepo.create).not.toHaveBeenCalled();
    });

    it('throws when assignee is not an active member', async () => {
      mockDbSelectSequential([[mockMembership], []]);
      policy.isAtLeast.mockReturnValue(true);

      await expect(
        service.create('c1', 'b1', 'w1', 'u1', {
          title: 'Task',
          assigneeId: 'u9',
        }),
      ).rejects.toThrow('not an active member');
    });

    it('creates a task when assignee is an active member', async () => {
      mockDbSelectSequential([[mockMembership], [mockMembership]]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue(mockColumn);
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);
      tasksRepo.create.mockResolvedValue({ ...mockTask, assigneeId: 'u2' });

      const result = await service.create('c1', 'b1', 'w1', 'u1', {
        title: 'Task',
        assigneeId: 'u2',
      });

      expect(tasksRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: 'u2' }),
      );
      expect(result.assigneeId).toBe('u2');
    });
  });

  describe('getById', () => {
    it('returns task when found', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);

      const result = await service.getById('t1', 'u1');
      expect(result.id).toBe('t1');
    });

    it('throws when missing', async () => {
      tasksRepo.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing', 'u1')).rejects.toThrow(
        'Task not found.',
      );
    });

    it('throws when the caller is not a workspace member', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelect([]);

      await expect(service.getById('t1', 'outsider')).rejects.toThrow(
        'not a member',
      );
    });
  });

  describe('listByBoard', () => {
    it('returns tasks for board', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);
      tasksRepo.listByBoard.mockResolvedValue([mockTask]);

      const result = await service.listByBoard('b1', 'w1', 'u1');
      expect(result).toHaveLength(1);
    });

    it('throws when the board belongs to a different workspace (cross-workspace read)', async () => {
      // Regression: listByBoard used to check role against the path
      // workspace but fetch rows by raw boardId, leaking another
      // workspace's tasks.
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b-foreign',
        workspaceId: 'w-other',
      } as never);

      await expect(
        service.listByBoard('b-foreign', 'w1', 'u1'),
      ).rejects.toThrow('Board not found');
      expect(tasksRepo.listByBoard).not.toHaveBeenCalled();
    });
  });

  describe('listByColumn', () => {
    it('returns tasks for column', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue(mockColumn);
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);
      tasksRepo.listByColumn.mockResolvedValue([mockTask]);

      const result = await service.listByColumn('c1', 'b1', 'w1', 'u1');
      expect(result).toHaveLength(1);
    });

    it('throws when the column belongs to a different board (cross-workspace read)', async () => {
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.findColumnById.mockResolvedValue({
        ...mockColumn,
        boardId: 'b-foreign',
      });
      tasksRepo.findBoardById.mockResolvedValue({
        id: 'b1',
        workspaceId: 'w1',
      } as never);

      await expect(
        service.listByColumn('c-foreign', 'b1', 'w1', 'u1'),
      ).rejects.toThrow('Column not found');
      expect(tasksRepo.listByColumn).not.toHaveBeenCalled();
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

    it('publishes assignee diff in TaskUpdated', async () => {
      const previouslyAssigned = { ...mockTask, assigneeId: 'u2' };
      const reassigned = { ...mockTask, assigneeId: 'u3' };
      tasksRepo.findById.mockResolvedValue(previouslyAssigned);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.update.mockResolvedValue(reassigned);

      await service.update('t1', 'u1', { assigneeId: 'u3' });

      expect(events.publishTaskUpdated).toHaveBeenCalledWith({
        taskId: 't1',
        workspaceId: 'w1',
        boardId: 'b1',
        updatedBy: 'u1',
        title: 'Set up CI/CD',
        previousAssigneeId: 'u2',
        assigneeId: 'u3',
      });
    });

    it('throws when assignee is not an active member', async () => {
      tasksRepo.findById.mockResolvedValue(mockTask);
      mockDbSelectSequential([[mockMembership], []]);
      policy.isAtLeast.mockReturnValue(true);

      await expect(
        service.update('t1', 'u1', { assigneeId: 'u9' }),
      ).rejects.toThrow('not an active member');
    });

    it('unassigns without a member check when assigneeId is null', async () => {
      tasksRepo.findById.mockResolvedValue({ ...mockTask, assigneeId: 'u2' });
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.update.mockResolvedValue({ ...mockTask, assigneeId: null });

      const result = await service.update('t1', 'u1', { assigneeId: null });

      expect(result.assigneeId).toBeNull();
      expect(tasksRepo.update).toHaveBeenCalled();
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
        workspaceId: 'w1',
        boardId: 'b1',
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
