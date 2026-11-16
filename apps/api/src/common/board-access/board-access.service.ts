import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  and,
  boards,
  DATABASE,
  eq,
  isNull,
  workspaceMembers,
  type Db,
} from '@repo/database';
import { EventEmitter } from 'node:events';
import { canUseBoard } from './board-visibility';

@Injectable()
export class BoardAccessService {
  private readonly events = new EventEmitter();
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  onChanged(listener: (boardId: string) => void) {
    this.events.on('changed', listener);
  }

  async require(
    boardId: string,
    userId: string,
    workspaceId?: string,
    admin = false,
  ) {
    const [entry] = await this.db
      .select({ board: boards, role: workspaceMembers.role })
      .from(boards)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, boards.workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .where(and(eq(boards.id, boardId), isNull(boards.deletedAt)))
      .limit(1);
    if (
      !entry ||
      (workspaceId && entry.board.workspaceId !== workspaceId) ||
      !canUseBoard(entry.role, userId, entry.board.accessUserIds) ||
      (admin && !['OWNER', 'ADMIN'].includes(entry.role))
    )
      throw new ForbiddenException('Board access denied.');
    return entry;
  }

  async get(boardId: string, userId: string, workspaceId: string) {
    const { board } = await this.require(boardId, userId, workspaceId, true);
    return {
      userIds: board.accessUserIds,
      mode: board.accessUserIds === null ? 'workspace' : 'restricted',
    };
  }

  async set(
    boardId: string,
    userId: string,
    workspaceId: string,
    userIds: string[] | null,
  ) {
    await this.require(boardId, userId, workspaceId, true);
    await this.db.transaction(async (tx) => {
      // Serialize concurrent access edits; validate grants using the same connection.
      await tx
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.id, boardId))
        .for('update');
      if (userIds?.length) {
        const members = await tx
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.status, 'ACTIVE'),
            ),
          );
        const active = new Set(members.map((member) => member.userId));
        if (userIds.some((id) => !active.has(id)))
          throw new BadRequestException(
            'Select active members of this workspace only.',
          );
      }
      await tx
        .update(boards)
        .set({
          accessUserIds: userIds === null ? null : [...new Set(userIds)],
          updatedAt: new Date(),
        })
        .where(eq(boards.id, boardId));
    });
    this.events.emit('changed', boardId);
    return { userIds, mode: userIds === null ? 'workspace' : 'restricted' };
  }
}
