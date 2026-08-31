import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type WorkspaceRole,
  boards,
  workspaces,
  workspaceMembers,
} from '@repo/database';

@Injectable()
export class UsageRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async countActiveSeats(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      );
    return row?.count ?? 0;
  }

  public async countBoards(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(boards)
      .where(
        and(
          eq(boards.workspaceId, workspaceId),
          sql`${boards.deletedAt} IS NULL`,
        ),
      );
    return row?.count ?? 0;
  }

  public async countOwnedWorkspaces(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.ownerId, userId),
          sql`${workspaces.deletedAt} IS NULL`,
        ),
      );
    return row?.count ?? 0;
  }

  public async findActiveMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | undefined> {
    const [row] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return row?.role;
  }

  public async findOwnerId(workspaceId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    return row?.ownerId;
  }
}
