import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  boards,
  DATABASE,
  desc,
  eq,
  sql,
  type Db,
  type NewWorkspaceRow,
  type WorkspaceRow,
  workspaceMembers,
  workspaces,
} from '@repo/database';

@Injectable()
export class WorkspacesRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewWorkspaceRow): Promise<WorkspaceRow> {
    const [created] = await this.db.insert(workspaces).values(row).returning();
    if (!created) throw new Error('Failed to insert workspace.');
    return created;
  }

  public async findById(id: string): Promise<WorkspaceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(sql`${workspaces.id} = ${id} AND ${workspaces.deletedAt} IS NULL`)
      .limit(1);
    return row;
  }

  public async findBySlug(slug: string): Promise<WorkspaceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(
        sql`${workspaces.slug} = ${slug} AND ${workspaces.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  public async update(
    id: string,
    data: Partial<
      Pick<
        NewWorkspaceRow,
        'name' | 'slug' | 'description' | 'logoUrl' | 'website'
      >
    >,
  ): Promise<WorkspaceRow> {
    const [updated] = await this.db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workspaces.id, id), sql`${workspaces.deletedAt} IS NULL`))
      .returning();
    if (!updated) throw new Error('Failed to update workspace.');
    return updated;
  }

  public async archive(id: string): Promise<void> {
    await this.db
      .update(workspaces)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id));
  }

  public async unarchive(id: string): Promise<void> {
    await this.db
      .update(workspaces)
      .set({
        status: 'ACTIVE',
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id));
  }

  public async softDelete(id: string): Promise<void> {
    await this.db
      .update(workspaces)
      .set({
        status: 'DELETED',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id));
  }

  public async listByUser(
    userId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<WorkspaceRow[]> {
    const { limit = 20, offset = 0 } = opts;
    const rows = await this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        ownerId: workspaces.ownerId,
        status: workspaces.status,
        description: workspaces.description,
        logoUrl: workspaces.logoUrl,
        website: workspaces.website,
        settings: workspaces.settings,
        archivedAt: workspaces.archivedAt,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
        deletedAt: workspaces.deletedAt,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          eq(workspaceMembers.userId, userId),
          sql`${workspaceMembers.deletedAt} IS NULL`,
          sql`${workspaceMembers.status} = 'ACTIVE'`,
        ),
      )
      .where(sql`${workspaces.deletedAt} IS NULL`)
      .orderBy(desc(workspaces.createdAt))
      .limit(limit)
      .offset(offset);
    return rows;
  }

  async countBoardsByWorkspaces(
    workspaceIds: string[],
  ): Promise<{ workspaceId: string; count: number }[]> {
    if (workspaceIds.length === 0) return [];
    return this.db
      .select({
        workspaceId: boards.workspaceId,
        count: sql<number>`count(*)::int`,
      })
      .from(boards)
      .where(
        sql`${boards.workspaceId} IN (${sql.join(
          workspaceIds.map((id) => sql`${id}`),
          sql`,`,
        )})`,
      )
      .groupBy(boards.workspaceId);
  }
}
