import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import { TextEncoder } from 'node:util';

import { UsersService } from '../../users/services/users.service';
import { NotificationsEventBus } from '../../notifications/events/notifications.events';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import type {
  PresenceUser,
  ObjectLock,
} from '../interfaces/presence.interface';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  displayName?: string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/canvas',
})
export class CanvasGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  private boardRooms = new Map<string, Map<string, PresenceUser>>();

  private objectLocks = new Map<string, Map<string, ObjectLock>>();

  private static readonly LOCK_TTL_MS = 30_000;

  private readonly jwtSecret: string;

  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(NotificationsEventBus)
    private readonly notificationsBus: NotificationsEventBus,
    @Inject(BoardsRepository)
    private readonly boardsRepo: BoardsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly membersRepo: WorkspaceMembersRepository,
    config: ConfigService,
  ) {
    const secret = config.get<string>('auth.jwt.access.secret');
    if (!secret) {
      throw new Error('auth.jwt.access.secret is not configured');
    }
    this.jwtSecret = secret;
  }

  onModuleInit(): void {
    this.notificationsBus.onNotificationCreated((payload) => {
      this.server
        .to(`user:${payload.userId}`)
        .emit('notification:created', payload);
    });
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = String(
      client.handshake.auth?.token ?? client.handshake.query?.token ?? '',
    );
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      const userId = payload.sub as string;
      client.userId = userId;
      client.displayName = await this.resolveDisplayName(userId);
      await client.join(`user:${userId}`);
      this.syncStaleName(client);
    } catch {
      client.disconnect();
    }
  }

  private async resolveDisplayName(userId: string): Promise<string> {
    try {
      const user = await this.users.getProfile(userId);
      return user.displayName || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * True when the user is an active member of the workspace that owns the
   * board. Resolves the board -> workspace first, then checks membership.
   * Used to keep sockets out of boards they do not belong to.
   */
  private async isBoardMember(
    userId: string,
    boardId: string,
  ): Promise<boolean> {
    try {
      const board = await this.boardsRepo.findById(boardId);
      if (!board) return false;
      const membership = await this.membersRepo.findByWorkspaceAndUser(
        board.workspaceId,
        userId,
      );
      return Boolean(membership);
    } catch {
      return false;
    }
  }

  private syncStaleName(client: AuthenticatedSocket): void {
    if (!client.userId || !client.displayName) return;
    for (const [boardId, users] of this.boardRooms) {
      const entry = users.get(client.userId);
      if (entry && entry.displayName !== client.displayName) {
        entry.displayName = client.displayName;
        this.boardRooms.set(boardId, users);
        this.server
          .to(`board:${boardId}`)
          .emit('presence:update', Array.from(users.values()));
      }
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.userId) {
      for (const [boardId, users] of this.boardRooms) {
        if (users.delete(client.userId)) {
          this.boardRooms.set(boardId, users);
          this.server
            .to(`board:${boardId}`)
            .emit('presence:update', Array.from(users.values()));
        }
      }
      this.releaseUserLocks(client.userId);
    }
  }

  @SubscribeMessage('board:join')
  handleJoinBoard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string },
  ): void {
    if (!client.userId || !data.boardId) return;
    const userId = client.userId;
    void (async () => {
      if (!(await this.isBoardMember(userId, data.boardId))) {
        client.emit('board:join:denied', { boardId: data.boardId });
        return;
      }
      if (!client.displayName) {
        client.displayName = await this.resolveDisplayName(userId);
      }
      await client.join(`board:${data.boardId}`);
      if (!this.boardRooms.has(data.boardId)) {
        this.boardRooms.set(data.boardId, new Map());
      }
      const users = this.boardRooms.get(data.boardId)!;
      users.set(client.userId!, {
        userId: client.userId!,
        displayName: client.displayName || 'Unknown',
        joinedAt: new Date(),
      });
      client.emit('presence:update', Array.from(users.values()));
      client
        .to(`board:${data.boardId}`)
        .emit('presence:update', Array.from(users.values()));
    })();
  }

  @SubscribeMessage('board:leave')
  handleLeaveBoard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string },
  ): void {
    if (!client.userId) return;
    void client.leave(`board:${data.boardId}`);
    const users = this.boardRooms.get(data.boardId);
    if (users) {
      users.delete(client.userId);
      client
        .to(`board:${data.boardId}`)
        .emit('presence:update', Array.from(users.values()));
    }
  }

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; cursor: { x: number; y: number } },
  ): void {
    if (!client.userId) return;
    const users = this.boardRooms.get(data.boardId);
    if (users && users.has(client.userId)) {
      const user = users.get(client.userId)!;
      user.cursor = data.cursor;
      client.to(`board:${data.boardId}`).emit('cursor:moved', {
        userId: client.userId,
        displayName: user.displayName || null,
        cursor: data.cursor,
      });
    }
  }

  @SubscribeMessage('object:created')
  handleObjectCreated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; object: unknown },
  ): void {
    if (!client.userId || !data.boardId) return;
    void (async () => {
      if (!(await this.isBoardMember(client.userId!, data.boardId))) return;
      client.to(`board:${data.boardId}`).emit('object:created', data.object);
    })();
  }

  @SubscribeMessage('object:updated')
  handleObjectUpdated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; object: unknown },
  ): void {
    if (!client.userId || !data.boardId) return;
    void (async () => {
      if (!(await this.isBoardMember(client.userId!, data.boardId))) return;
      client.to(`board:${data.boardId}`).emit('object:updated', data.object);
    })();
  }

  @SubscribeMessage('object:deleted')
  handleObjectDeleted(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; objectId: string },
  ): void {
    if (!client.userId || !data.boardId) return;
    void (async () => {
      if (!(await this.isBoardMember(client.userId!, data.boardId))) return;
      client.to(`board:${data.boardId}`).emit('object:deleted', data.objectId);
    })();
  }

  private getBoardLocks(boardId: string): Map<string, ObjectLock> {
    const now = Date.now();
    const locks =
      this.objectLocks.get(boardId) ?? new Map<string, ObjectLock>();
    for (const [objectId, lock] of locks) {
      if (lock.expiresAt <= now) locks.delete(objectId);
    }
    this.objectLocks.set(boardId, locks);
    return locks;
  }

  private releaseUserLocks(userId: string): void {
    for (const [boardId, locks] of this.objectLocks) {
      for (const [objectId, lock] of locks) {
        if (lock.userId !== userId) continue;
        locks.delete(objectId);
        this.server.to(`board:${boardId}`).emit('object:unlocked', {
          objectId,
          userId,
        });
      }
      if (locks.size === 0) this.objectLocks.delete(boardId);
    }
  }

  @SubscribeMessage('object:lock')
  handleObjectLock(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; objectId: string },
  ): void {
    if (!client.userId || !data.objectId) return;
    const locks = this.getBoardLocks(data.boardId);
    const held = locks.get(data.objectId);
    if (held && held.userId !== client.userId) {
      client.emit('object:lock:denied', {
        objectId: data.objectId,
        displayName: held.displayName,
      });
      return;
    }
    if (held) held.expiresAt = Date.now() + CanvasGateway.LOCK_TTL_MS;
    else {
      locks.set(data.objectId, {
        objectId: data.objectId,
        userId: client.userId,
        displayName: client.displayName || 'Unknown',
        expiresAt: Date.now() + CanvasGateway.LOCK_TTL_MS,
      });
    }
    client.to(`board:${data.boardId}`).emit('object:locked', {
      objectId: data.objectId,
      userId: client.userId,
      displayName: client.displayName || 'Unknown',
    });
  }

  @SubscribeMessage('object:unlock')
  handleObjectUnlock(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; objectId: string },
  ): void {
    if (!client.userId) return;
    const locks = this.getBoardLocks(data.boardId);
    const held = locks.get(data.objectId);
    if (held && held.userId === client.userId) {
      locks.delete(data.objectId);
      if (locks.size === 0) this.objectLocks.delete(data.boardId);
      client.to(`board:${data.boardId}`).emit('object:unlocked', {
        objectId: data.objectId,
        userId: client.userId,
      });
    }
  }
}
