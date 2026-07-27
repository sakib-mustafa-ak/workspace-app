import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type BoardColumnRow,
  type Db,
  type NewBoardColumnRow,
  boardColumns,
} from '@repo/database';

@Injectable()
export class BoardColumnsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewBoardColumnRow): Promise<BoardColumnRow> {
    const [created] = await this.db
      .insert(boardColumns)
      .values(row)
      .returning();
    if (!created) throw new Error('Failed to insert board column.');
    return created;
  }

  public async findById(id: string): Promise<BoardColumnRow | undefined> {
    const [row] = await this.db
      .select()
      .from(boardColumns)
      .where(
        sql`${boardColumns.id} = ${id} AND ${boardColumns.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  public async listByBoard(boardId: string): Promise<BoardColumnRow[]> {
    return this.db
      .select()
      .from(boardColumns)
      .where(
        sql`${boardColumns.boardId} = ${boardId} AND ${boardColumns.deletedAt} IS NULL`,
      )
      .orderBy(sql`${boardColumns.position} ASC NULLS LAST`);
  }

  public async update(
    id: string,
    data: Partial<Pick<NewBoardColumnRow, 'name' | 'position'>>,
  ): Promise<BoardColumnRow> {
    const [updated] = await this.db
      .update(boardColumns)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(boardColumns.id, id), sql`${boardColumns.deletedAt} IS NULL`),
      )
      .returning();
    if (!updated) throw new Error('Failed to update board column.');
    return updated;
  }

  public async archive(id: string): Promise<void> {
    await this.db
      .update(boardColumns)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boardColumns.id, id));
  }

  public async softDelete(id: string): Promise<void> {
    await this.db
      .update(boardColumns)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boardColumns.id, id));
  }
}
