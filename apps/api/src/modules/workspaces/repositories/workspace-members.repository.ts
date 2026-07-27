import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type NewWorkspaceMemberRow,
  type WorkspaceMemberRow,
  workspaceMembers,
} from '@repo/database';

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

  public async listByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceMemberRow[]> {
    return this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
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
}
