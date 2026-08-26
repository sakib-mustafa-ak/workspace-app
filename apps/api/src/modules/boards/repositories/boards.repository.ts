import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  desc,
  eq,
  sql,
  type Db,
  type DbExecutor,
  type BoardRow,
  type NewBoardRow,
  boards,
} from '@repo/database';

@Injectable()
export class BoardsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewBoardRow, tx?: DbExecutor): Promise<BoardRow> {
    const exec = tx ?? this.db;
    const [created] = await exec.insert(boards).values(row).returning();
    if (!created) throw new Error('Failed to insert board.');
    return created;
  }

  public async findById(id: string): Promise<BoardRow | undefined> {
    const [row] = await this.db
      .select()
      .from(boards)
      .where(sql`${boards.id} = ${id} AND ${boards.deletedAt} IS NULL`)
      .limit(1);
    return row;
  }

  public async listByWorkspace(workspaceId: string): Promise<BoardRow[]> {
    return this.db
      .select()
      .from(boards)
      .where(
        and(
          eq(boards.workspaceId, workspaceId),
          sql`${boards.deletedAt} IS NULL`,
        ),
      )
      .orderBy(desc(boards.position), desc(boards.createdAt));
  }

  public async update(
    id: string,
    data: Partial<Pick<NewBoardRow, 'name' | 'description' | 'position'>>,
  ): Promise<BoardRow> {
    const [updated] = await this.db
      .update(boards)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(boards.id, id), sql`${boards.deletedAt} IS NULL`))
      .returning();
    if (!updated) throw new Error('Failed to update board.');
    return updated;
  }

  public async archive(id: string): Promise<void> {
    await this.db
      .update(boards)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boards.id, id));
  }

  public async unarchive(id: string): Promise<void> {
    await this.db
      .update(boards)
      .set({
        status: 'ACTIVE',
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(boards.id, id));
  }

  public async softDelete(id: string): Promise<void> {
    await this.db
      .update(boards)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boards.id, id));
  }
}
