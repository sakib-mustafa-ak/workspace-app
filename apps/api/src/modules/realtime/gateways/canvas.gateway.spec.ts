import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CanvasGateway } from './canvas.gateway';
import type { AuthenticatedSocket } from './canvas.gateway';
import { UsersService } from '../../users/services/users.service';
import { NotificationsEventBus } from '../../notifications/events/notifications.events';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

describe('CanvasGateway', () => {
  let gateway: CanvasGateway;
  let membersRepo: { findByWorkspaceAndUser: jest.Mock };
  let boardsRepo: { findById: jest.Mock };

  beforeEach(async () => {
    boardsRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'b-1', workspaceId: 'w-1' }),
    };
    membersRepo = {
      findByWorkspaceAndUser: jest.fn().mockResolvedValue({ id: 'm-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasGateway,
        {
          provide: UsersService,
          useValue: {
            getProfile: jest
              .fn()
              .mockResolvedValue({ displayName: 'Test User' }),
          },
        },
        {
          provide: NotificationsEventBus,
          useValue: {
            onNotificationCreated: jest.fn(),
          },
        },
        { provide: BoardsRepository, useValue: boardsRepo },
        { provide: WorkspaceMembersRepository, useValue: membersRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    gateway = module.get<CanvasGateway>(CanvasGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('relays object:created to the board room when the user is a member', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const client = {
      id: 'sock-' + Math.random(),
      userId: 'u-1',
      to,
    } as unknown as AuthenticatedSocket;
    const object = { id: 'obj-1', boardId: 'b-1' };

    gateway.handleObjectCreated(client, {
      boardId: 'b-1',
      object,
    } as never);
    await new Promise((r) => setImmediate(r));

    expect(to).toHaveBeenCalledWith('board:b-1');
    expect(emit).toHaveBeenCalledWith('object:created', object);
  });

  it('does not relay object:created when the user is not a member', async () => {
    membersRepo.findByWorkspaceAndUser.mockResolvedValue(undefined);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const client = {
      id: 'sock-' + Math.random(),
      userId: 'u-1',
      to,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectCreated(client, {
      boardId: 'b-1',
      object: { id: 'obj-1' },
    } as never);
    await new Promise((r) => setImmediate(r));

    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('relays object:updated to the board room when the user is a member', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const client = {
      id: 'sock-' + Math.random(),
      userId: 'u-1',
      to,
    } as unknown as AuthenticatedSocket;
    const object = { id: 'obj-1', x: 10 };

    gateway.handleObjectUpdated(client, {
      boardId: 'b-1',
      object,
    } as never);
    await new Promise((r) => setImmediate(r));

    expect(to).toHaveBeenCalledWith('board:b-1');
    expect(emit).toHaveBeenCalledWith('object:updated', object);
  });

  it('relays object:deleted to the board room when the user is a member', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const client = {
      id: 'sock-' + Math.random(),
      userId: 'u-1',
      to,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectDeleted(client, {
      boardId: 'b-1',
      objectId: 'o-1',
    } as never);
    await new Promise((r) => setImmediate(r));

    expect(to).toHaveBeenCalledWith('board:b-1');
    expect(emit).toHaveBeenCalledWith('object:deleted', 'o-1');
  });

  it('denies board:join when the user is not a member', async () => {
    membersRepo.findByWorkspaceAndUser.mockResolvedValue(undefined);
    const emit = jest.fn();
    const join = jest.fn().mockResolvedValue(undefined);
    const client = {
      userId: 'u-1',
      displayName: 'Test User',
      emit,
      join,
    } as unknown as AuthenticatedSocket;

    gateway.handleJoinBoard(client, { boardId: 'b-1' });
    await new Promise((r) => setImmediate(r));

    expect(emit).toHaveBeenCalledWith('board:join:denied', { boardId: 'b-1' });
    expect(join).not.toHaveBeenCalled();
  });

  it('joins the board room when the user is a member', async () => {
    const emit = jest.fn();
    const join = jest.fn().mockResolvedValue(undefined);
    const client = {
      userId: 'u-1',
      displayName: 'Test User',
      emit,
      join,
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as AuthenticatedSocket;

    gateway.handleJoinBoard(client, { boardId: 'b-1' });
    await new Promise((r) => setImmediate(r));

    expect(join).toHaveBeenCalledWith('board:b-1');
  });

  it('grants a lock and broadcasts object:locked to the room', () => {
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const client = {
      userId: 'u-1',
      displayName: 'Test User',
      to,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectLock(client, {
      boardId: 'b-1',
      objectId: 'o-1',
    } as never);

    expect(to).toHaveBeenCalledWith('board:b-1');
  });

  it('denies a lock held by another user and notifies the requester', () => {
    const emit = jest.fn();
    const a = {
      userId: 'u-1',
      displayName: 'Alice',
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as AuthenticatedSocket;
    const b = {
      userId: 'u-2',
      displayName: 'Bob',
      emit,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectLock(a, { boardId: 'b-1', objectId: 'o-1' } as never);
    gateway.handleObjectLock(b, { boardId: 'b-1', objectId: 'o-1' } as never);

    expect(emit).toHaveBeenCalledWith('object:lock:denied', {
      objectId: 'o-1',
      displayName: 'Alice',
    });
  });

  it('releases a lock on unlock and broadcasts object:unlocked', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const a = {
      userId: 'u-1',
      displayName: 'Alice',
      to,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectLock(a, { boardId: 'b-1', objectId: 'o-1' } as never);
    gateway.handleObjectUnlock(a, { boardId: 'b-1', objectId: 'o-1' } as never);

    expect(to).toHaveBeenCalledWith('board:b-1');
    expect(emit).toHaveBeenCalledWith('object:unlocked', {
      objectId: 'o-1',
      userId: 'u-1',
    });
  });
});
