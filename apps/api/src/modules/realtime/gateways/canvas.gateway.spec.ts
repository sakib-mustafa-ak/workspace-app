import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CanvasGateway } from './canvas.gateway';
import type { AuthenticatedSocket } from './canvas.gateway';
import { UsersService } from '../../users/services/users.service';
import { NotificationsEventBus } from '../../notifications/events/notifications.events';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';
import { SignJWT } from 'jose';
import { BoardAccessService } from '../../../common/board-access/board-access.service';
import { BoardPresenceService } from '../../../common/board-access/board-presence.service';

describe('CanvasGateway', () => {
  let gateway: CanvasGateway;
  let membersRepo: { findByWorkspaceAndUser: jest.Mock };
  let boardsRepo: { findById: jest.Mock; listByWorkspace: jest.Mock };
  let users: { getProfile: jest.Mock };
  let accessChanged: (boardId: string) => void;

  beforeEach(async () => {
    boardsRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'b-1', workspaceId: 'w-1' }),
      listByWorkspace: jest.fn().mockResolvedValue([]),
    };
    membersRepo = {
      findByWorkspaceAndUser: jest
        .fn()
        .mockResolvedValue({ id: 'm-1', role: 'EDITOR', status: 'ACTIVE' }),
    };
    users = {
      getProfile: jest.fn().mockResolvedValue({
        displayName: 'Test User',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BoardAccessService,
          useValue: {
            onChanged: jest.fn((listener: (boardId: string) => void) => {
              accessChanged = listener;
            }),
          },
        },
        BoardPresenceService,
        CanvasGateway,
        {
          provide: UsersService,
          useValue: users,
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
          provide: WorkspacesEventBus,
          useValue: {
            onMemberRemoved: jest.fn(),
            onMemberRoleChanged: jest.fn(),
          },
        },
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
  it('denies restricted board joins even for an active workspace member', async () => {
    boardsRepo.findById.mockResolvedValue({
      id: 'b-1',
      workspaceId: 'w-1',
      accessUserIds: ['u-2'],
    });
    const client = {
      id: 'socket',
      userId: 'u-1',
      emit: jest.fn(),
      join: jest.fn(),
    } as unknown as AuthenticatedSocket;
    gateway.handleJoinBoard(client, { boardId: 'b-1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('board:join:denied', {
      boardId: 'b-1',
    });
  });
  it('revokes cached realtime access when board grants change', async () => {
    gateway.onModuleInit();
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-1')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('test-secret'));
    const client = {
      id: 'socket',
      handshake: { auth: { token } },
      rooms: new Set(['board:b-1']),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as AuthenticatedSocket;
    await gateway.handleConnection(client);
    gateway.server = {
      sockets: { sockets: new Map([['socket', client]]) },
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as CanvasGateway['server'];
    gateway.handleJoinBoard(client, { boardId: 'b-1' });
    await new Promise((resolve) => setImmediate(resolve));
    boardsRepo.findById.mockResolvedValue({
      id: 'b-1',
      workspaceId: 'w-1',
      accessUserIds: [],
    });
    accessChanged('b-1');
    expect(client.leave).toHaveBeenCalledWith('board:b-1');
    client.emit = jest.fn();
    gateway.handleJoinBoard(client, { boardId: 'b-1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(client.emit).toHaveBeenCalledWith('board:join:denied', {
      boardId: 'b-1',
    });
  });

  it.each(['namespace', 'server'])(
    'does not evict unrelated boards using a %s socket map',
    (shape) => {
      gateway.onModuleInit();
      const affected = {
        rooms: new Set(['board:b-1', 'board:b-2']),
        leave: jest.fn(),
        emit: jest.fn(),
      };
      const unrelated = {
        rooms: new Set(['board:b-2']),
        leave: jest.fn(),
        emit: jest.fn(),
      };
      gateway.server = {
        sockets:
          shape === 'namespace'
            ? new Map([
                ['affected', affected],
                ['unrelated', unrelated],
              ])
            : {
                sockets: new Map([
                  ['affected', affected],
                  ['unrelated', unrelated],
                ]),
              },
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      } as unknown as CanvasGateway['server'];
      const internals = gateway as unknown as {
        socketUsers: Map<string, string>;
        objectLocks: Map<
          string,
          Map<string, { userId: string; socketId: string }>
        >;
      };
      internals.socketUsers.set('affected', 'u-1');
      internals.socketUsers.set('unrelated', 'u-2');
      internals.objectLocks.set(
        'b-1',
        new Map([['a', { userId: 'u-1', socketId: 'affected' }]]),
      );
      internals.objectLocks.set(
        'b-2',
        new Map([['b', { userId: 'u-1', socketId: 'affected' }]]),
      );

      accessChanged('b-1');

      expect(affected.leave).toHaveBeenCalledWith('board:b-1');
      expect(affected.emit).toHaveBeenCalledWith('board:join:denied', {
        boardId: 'b-1',
        reason: 'access_changed',
      });
      expect(unrelated.leave).not.toHaveBeenCalled();
      expect(unrelated.emit).not.toHaveBeenCalled();
      expect(internals.objectLocks.has('b-1')).toBe(false);
      expect(internals.objectLocks.get('b-2')?.has('b')).toBe(true);
    },
  );

  it.each([false, true])(
    'requires verified email for realtime connections: verified=%s',
    async (verified) => {
      users.getProfile.mockResolvedValue({
        displayName: 'Test User',
        status: 'ACTIVE',
        emailVerifiedAt: verified ? new Date() : null,
      });
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('user')
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('test-secret'));
      const client = {
        id: 'socket-test',
        handshake: { auth: { token } },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
      };
      await gateway.handleConnection(client as unknown as AuthenticatedSocket);
      if (verified) {
        expect(client.join).toHaveBeenCalledWith('user:user');
        expect(client.disconnect).not.toHaveBeenCalled();
      } else {
        expect(client.disconnect).toHaveBeenCalled();
        expect(client.join).not.toHaveBeenCalled();
      }
    },
  );

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

  it('grants a lock and broadcasts object:locked to the room', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const client = {
      id: 'sock-1',
      userId: 'u-1',
      displayName: 'Test User',
      to,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectLock(client, {
      boardId: 'b-1',
      objectId: 'o-1',
    } as never);
    await new Promise((r) => setImmediate(r));

    expect(to).toHaveBeenCalledWith('board:b-1');
  });

  it('denies a lock held by another user and notifies the requester', async () => {
    const emit = jest.fn();
    const a = {
      id: 'sock-a',
      userId: 'u-1',
      displayName: 'Alice',
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as AuthenticatedSocket;
    const b = {
      id: 'sock-b',
      userId: 'u-2',
      displayName: 'Bob',
      emit,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectLock(a, { boardId: 'b-1', objectId: 'o-1' } as never);
    await new Promise((r) => setImmediate(r));
    gateway.handleObjectLock(b, { boardId: 'b-1', objectId: 'o-1' } as never);
    await new Promise((r) => setImmediate(r));

    expect(emit).toHaveBeenCalledWith('object:lock:denied', {
      objectId: 'o-1',
      displayName: 'Alice',
    });
  });

  it('releases a lock on unlock and broadcasts object:unlocked', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const a = {
      id: 'sock-a',
      userId: 'u-1',
      displayName: 'Alice',
      to,
    } as unknown as AuthenticatedSocket;

    gateway.handleObjectLock(a, { boardId: 'b-1', objectId: 'o-1' } as never);
    await new Promise((r) => setImmediate(r));
    gateway.handleObjectUnlock(a, { boardId: 'b-1', objectId: 'o-1' } as never);
    await new Promise((r) => setImmediate(r));

    expect(to).toHaveBeenCalledWith('board:b-1');
    expect(emit).toHaveBeenCalledWith('object:unlocked', {
      objectId: 'o-1',
      userId: 'u-1',
    });
  });
});
