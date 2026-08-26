import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { BoardsRepository } from '../../modules/boards/repositories/boards.repository';
import { TasksRepository } from '../../modules/tasks/repositories/tasks.repository';
import {
  WorkspaceAccess,
  WORKSPACE_ACCESS_KEY,
} from '../decorators/workspace-access.decorator';
import { WorkspaceMembershipGuard } from './workspace-membership.guard';

type MockedRequest = Request & {
  user?: { id: string };
  params: Record<string, string>;
};

describe('WorkspaceMembershipGuard', () => {
  let guard: WorkspaceMembershipGuard;
  let getAllAndOverride: jest.Mock;
  let boardsRepo: { findById: jest.Mock };
  let tasksRepo: { findById: jest.Mock };
  let membershipRows: unknown[];
  let moduleRefGet: jest.Mock;

  beforeEach(() => {
    boardsRepo = { findById: jest.fn() };
    tasksRepo = { findById: jest.fn() };
    membershipRows = [];
    getAllAndOverride = jest.fn();
    moduleRefGet = jest.fn((token: unknown) => {
      if (token === BoardsRepository) return boardsRepo;
      if (token === TasksRepository) return tasksRepo;
      return undefined;
    });

    const reflector = {
      getAllAndOverride,
    } as never;

    const moduleRef = { get: moduleRefGet };
    guard = new WorkspaceMembershipGuard(
      reflector,
      moduleRef as never,
      {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(membershipRows),
            }),
          }),
        }),
      } as never,
    );
  });

  function contextOf(
    params: Record<string, string>,
    user?: { id: string },
  ): ExecutionContext {
    const request = { params, user } as MockedRequest;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  function requireAccess(...args: Parameters<typeof WorkspaceAccess>): void {
    getAllAndOverride.mockImplementation((key: unknown) => {
      if (key !== WORKSPACE_ACCESS_KEY) return undefined;
      const [role = 'VIEWER', options] = args;
      return { minimumRole: role, ...(options ?? {}) };
    });
  }

  it('allows routes without a workspace-access requirement', async () => {
    getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextOf({}, { id: 'u1' }))).resolves.toBe(
      true,
    );
    expect(moduleRefGet).not.toHaveBeenCalled();
  });

  it('denies when no authenticated user is present (fail closed)', async () => {
    requireAccess('VIEWER');

    await expect(
      guard.canActivate(contextOf({ workspaceId: 'w1' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('allows an active member meeting the minimum role', async () => {
    requireAccess('VIEWER');
    membershipRows = [
      {
        id: 'm1',
        role: 'EDITOR',
        status: 'ACTIVE',
        userId: 'u1',
        workspaceId: 'w1',
      },
    ];

    await expect(
      guard.canActivate(contextOf({ workspaceId: 'w1' }, { id: 'u1' })),
    ).resolves.toBe(true);
  });

  it('denies a member below the minimum role', async () => {
    requireAccess('ADMIN');
    membershipRows = [
      {
        id: 'm1',
        role: 'EDITOR',
        status: 'ACTIVE',
        userId: 'u1',
        workspaceId: 'w1',
      },
    ];

    await expect(
      guard.canActivate(contextOf({ workspaceId: 'w1' }, { id: 'u1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a non-member', async () => {
    requireAccess('VIEWER');
    membershipRows = [];

    await expect(
      guard.canActivate(contextOf({ workspaceId: 'w1' }, { id: 'u1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resolves the workspace through the board ownership chain', async () => {
    requireAccess('VIEWER');
    boardsRepo.findById.mockResolvedValue({
      id: 'b1',
      workspaceId: 'w-from-board',
    });
    membershipRows = [
      {
        id: 'm1',
        role: 'VIEWER',
        status: 'ACTIVE',
        userId: 'u1',
        workspaceId: 'w-from-board',
      },
    ];

    await expect(
      guard.canActivate(contextOf({ boardId: 'b1' }, { id: 'u1' })),
    ).resolves.toBe(true);
    expect(boardsRepo.findById).toHaveBeenCalledWith('b1');
  });

  it('denies when the board in the path does not exist', async () => {
    requireAccess('VIEWER');
    boardsRepo.findById.mockResolvedValue(undefined);

    await expect(
      guard.canActivate(contextOf({ boardId: 'missing' }, { id: 'u1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resolves the workspace through the task ownership chain', async () => {
    requireAccess('EDITOR');
    tasksRepo.findById.mockResolvedValue({
      id: 't1',
      workspaceId: 'w-from-task',
    });
    membershipRows = [
      {
        id: 'm1',
        role: 'OWNER',
        status: 'ACTIVE',
        userId: 'u1',
        workspaceId: 'w-from-task',
      },
    ];

    await expect(
      guard.canActivate(contextOf({ taskId: 't1' }, { id: 'u1' })),
    ).resolves.toBe(true);
    expect(tasksRepo.findById).toHaveBeenCalledWith('t1');
  });

  it('denies when no workspace can be resolved from the request', async () => {
    requireAccess('VIEWER');

    await expect(
      guard.canActivate(contextOf({}, { id: 'u1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('honors an explicit param override (audit-style workspaces/:id)', async () => {
    requireAccess('VIEWER', { param: 'id' });
    membershipRows = [];

    await expect(
      guard.canActivate(contextOf({ id: 'w-audit' }, { id: 'u1' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
