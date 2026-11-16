import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardPresenceService {
  private readonly sockets = new Map<
    string,
    { userId: string; displayName: string; boards: Set<string> }
  >();
  join(socketId: string, userId: string, displayName: string, boardId: string) {
    const current = this.sockets.get(socketId) ?? {
      userId,
      displayName,
      boards: new Set<string>(),
    };
    current.boards.add(boardId);
    this.sockets.set(socketId, current);
  }
  leave(socketId: string, boardId?: string) {
    if (!boardId) {
      this.sockets.delete(socketId);
      return;
    }
    const current = this.sockets.get(socketId);
    current?.boards.delete(boardId);
    if (!current?.boards.size) this.sockets.delete(socketId);
  }
  clearBoard(boardId: string) {
    for (const id of this.sockets.keys()) this.leave(id, boardId);
  }
  list(boardId: string) {
    const users = new Map<string, { userId: string; displayName: string }>();
    for (const user of this.sockets.values())
      if (user.boards.has(boardId))
        users.set(user.userId, {
          userId: user.userId,
          displayName: user.displayName,
        });
    return [...users.values()];
  }
}
