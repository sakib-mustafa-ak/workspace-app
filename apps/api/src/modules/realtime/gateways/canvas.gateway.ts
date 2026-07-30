import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import { TextEncoder } from 'node:util';

import type { PresenceUser } from '../interfaces/presence.interface';
import { CanvasEventBus } from '../../canvas/events/canvas.events';
import type {
  ObjectCreatedPayload,
  ObjectUpdatedPayload,
  ObjectDeletedPayload,
} from '../../canvas/events/canvas.events';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  displayName?: string;
}

@Injectable()
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/canvas',
})
export class CanvasGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private boardRooms = new Map<string, Map<string, PresenceUser>>();

  constructor(
    @Inject(CanvasEventBus) private readonly canvasEventBus: CanvasEventBus,
  ) {}

  afterInit(): void {
    this.canvasEventBus.onObjectCreated((payload: ObjectCreatedPayload) => {
      this.server
        .to(`board:${payload.boardId}`)
        .emit('object:created', payload);
    });

    this.canvasEventBus.onObjectUpdated((payload: ObjectUpdatedPayload) => {
      this.server
        .to(`board:${payload.boardId}`)
        .emit('object:updated', payload);
    });

    this.canvasEventBus.onObjectDeleted((payload: ObjectDeletedPayload) => {
      this.server
        .to(`board:${payload.boardId}`)
        .emit('object:deleted', payload);
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
      const jwtSecret = process.env.JWT_ACCESS_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_ACCESS_SECRET is not configured');
      }
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      client.userId = payload.sub as string;
      client.displayName =
        (payload as { displayName?: string }).displayName || 'Unknown';
    } catch {
      client.disconnect();
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
    }
  }

  @SubscribeMessage('board:join')
  handleJoinBoard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string },
  ): void {
    if (!client.userId) return;
    void client.join(`board:${data.boardId}`);
    if (!this.boardRooms.has(data.boardId)) {
      this.boardRooms.set(data.boardId, new Map());
    }
    const users = this.boardRooms.get(data.boardId)!;
    users.set(client.userId, {
      userId: client.userId,
      displayName: client.displayName || 'Unknown',
      joinedAt: new Date(),
    });
    client.emit('presence:update', Array.from(users.values()));
    client
      .to(`board:${data.boardId}`)
      .emit('presence:update', Array.from(users.values()));
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
        cursor: data.cursor,
      });
    }
  }

  @SubscribeMessage('object:created')
  handleObjectCreated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; object: unknown },
  ): void {
    client.to(`board:${data.boardId}`).emit('object:created', data.object);
  }

  @SubscribeMessage('object:updated')
  handleObjectUpdated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; object: unknown },
  ): void {
    client.to(`board:${data.boardId}`).emit('object:updated', data.object);
  }

  @SubscribeMessage('object:deleted')
  handleObjectDeleted(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string; objectId: string },
  ): void {
    client.to(`board:${data.boardId}`).emit('object:deleted', data.objectId);
  }
}
