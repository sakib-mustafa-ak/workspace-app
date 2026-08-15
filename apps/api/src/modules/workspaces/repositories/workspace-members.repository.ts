import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type NewWorkspaceMemberRow,
  type WorkspaceMemberRow,
  users,
  workspaceMembers,
  workspaces,
} from '@repo/database';

export type WorkspaceMemberWithUser = WorkspaceMemberRow & {
  user: { displayName: string; email: string } | null;
};

@Injectable()
export class WorkspaceMembersRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async add(row: NewWorkspaceMemberRow): Promise<WorkspaceMemberRow> {
    const [created] = await this.db
      .insert(workspaceMembers)
      .values(row)
      .returning();
    if (!created) throw new Error('Failed to add workspace member.');
    return created;
  }

  public async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
        ),
      )
      .limit(1);
    return row;
  }

  public async findById(id: string): Promise<WorkspaceMemberRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, id),
          sql`${workspaceMembers.deletedAt} IS NULL`,
        ),
      )
      .limit(1);
    return row;
  }

  public async listByUser(userId: string): Promise<WorkspaceMemberRow[]> {
    return this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
        ),
      )
      .orderBy(workspaceMembers.joinedAt);
  }

  public async listByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceMemberWithUser[]> {
    const rows = await this.db
      .select({
        member: workspaceMembers,
        user: { displayName: users.displayName, email: users.email },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
        ),
      )
      .orderBy(workspaceMembers.joinedAt);
    return rows.map((r) => ({ ...r.member, user: r.user }));
  }

  /**
   * Memberships for a user, with the workspace display name joined in —
   * used by the user profile's "Workspace memberships" section.
   */
  public async listByUserWithWorkspace(userId: string): Promise<
    Array<{
      workspaceId: string;
      workspaceName: string;
      role: WorkspaceMemberRow['role'];
      joinedAt: Date | null;
    }>
  > {
    return this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        workspaceName: workspaces.name,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
          sql`${workspaces.deletedAt} IS NULL`,
        ),
      )
      .orderBy(workspaceMembers.joinedAt);
  }

  public async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRow['role'],
  ): Promise<WorkspaceMemberRow> {
    const [updated] = await this.db
      .update(workspaceMembers)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
        ),
      )
      .returning();
    if (!updated) throw new Error('Failed to update member role.');
    return updated;
  }

  public async remove(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .update(workspaceMembers)
      .set({
        status: 'REMOVED',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      );
  }

  async countByWorkspaces(
    workspaceIds: string[],
  ): Promise<{ workspaceId: string; count: number }[]> {
    if (workspaceIds.length === 0) return [];
    return this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceMembers)
      .where(
        and(
          sql`${workspaceMembers.workspaceId} IN (${sql.join(
            workspaceIds.map((id) => sql`${id}`),
            sql`,`,
          )})`,
          sql`${workspaceMembers.deletedAt} IS NULL`,
        ),
      )
      .groupBy(workspaceMembers.workspaceId);
  }
}
