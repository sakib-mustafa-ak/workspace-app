import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  desc,
  eq,
  sql,
  type BoardColumnRow,
  type Db,
  type NewTaskRow,
  type TaskRow,
  boardColumns,
  tasks,
} from '@repo/database';

@Injectable()
export class TasksRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewTaskRow): Promise<TaskRow> {
    const [created] = await this.db.insert(tasks).values(row).returning();
    if (!created) throw new Error('Failed to insert task.');
    return created;
  }

  public async findById(id: string): Promise<TaskRow | undefined> {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(sql`${tasks.id} = ${id} AND ${tasks.deletedAt} IS NULL`)
      .limit(1);
    return row;
  }

  public async listByBoard(boardId: string): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.boardId, boardId), sql`${tasks.deletedAt} IS NULL`))
      .orderBy(sql`${tasks.position} ASC NULLS LAST`);
  }

  public async listByColumn(columnId: string): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.columnId, columnId), sql`${tasks.deletedAt} IS NULL`))
      .orderBy(sql`${tasks.position} ASC NULLS LAST`, desc(tasks.createdAt));
  }

  public async update(
    id: string,
    data: Partial<
      Pick<
        NewTaskRow,
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'position'
        | 'assigneeId'
        | 'columnId'
        | 'dueDate'
        | 'completedAt'
      >
    >,
  ): Promise<TaskRow> {
    const [updated] = await this.db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), sql`${tasks.deletedAt} IS NULL`))
      .returning();
    if (!updated) throw new Error('Failed to update task.');
    return updated;
  }

  public async softDelete(id: string): Promise<void> {
    await this.db
      .update(tasks)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));
  }

  public async findColumnById(id: string): Promise<BoardColumnRow | undefined> {
    const [row] = await this.db
      .select()
      .from(boardColumns)
      .where(
        sql`${boardColumns.id} = ${id} AND ${boardColumns.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }
}
