import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  asc,
  DATABASE,
  eq,
  sql,
  type CanvasObjectRow,
  type CanvasRow,
  type Db,
  type NewCanvasObjectRow,
  type NewCanvasRow,
  canvas,
  canvasObjects,
} from '@repo/database';

@Injectable()
export class CanvasRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async findByBoard(boardId: string): Promise<CanvasRow | undefined> {
    const [row] = await this.db
      .select()
      .from(canvas)
      .where(
        sql`${canvas.boardId} = ${boardId} AND ${canvas.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  async create(data: NewCanvasRow): Promise<CanvasRow> {
    const [row] = await this.db.insert(canvas).values(data).returning();
    if (!row) throw new Error('Failed to create canvas.');
    return row;
  }

  async findObjectsByCanvas(canvasId: string): Promise<CanvasObjectRow[]> {
    return this.db
      .select()
      .from(canvasObjects)
      .where(
        and(
          eq(canvasObjects.canvasId, canvasId),
          eq(canvasObjects.status, 'ACTIVE'),
          sql`${canvasObjects.deletedAt} IS NULL`,
        ),
      )
      .orderBy(asc(canvasObjects.zIndex));
  }

  async findObjectById(objectId: string): Promise<CanvasObjectRow | undefined> {
    const [row] = await this.db
      .select()
      .from(canvasObjects)
      .where(
        sql`${canvasObjects.id} = ${objectId} AND ${canvasObjects.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  async createObject(data: NewCanvasObjectRow): Promise<CanvasObjectRow> {
    const [row] = await this.db.insert(canvasObjects).values(data).returning();
    if (!row) throw new Error('Failed to create canvas object.');
    return row;
  }

  async updateObject(
    objectId: string,
    data: Partial<NewCanvasObjectRow>,
  ): Promise<CanvasObjectRow | undefined> {
    const [row] = await this.db
      .update(canvasObjects)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(canvasObjects.id, objectId),
          sql`${canvasObjects.deletedAt} IS NULL`,
        ),
      )
      .returning();
    return row;
  }

  async softDeleteObject(objectId: string): Promise<void> {
    await this.db
      .update(canvasObjects)
      .set({
        deletedAt: new Date(),
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canvasObjects.id, objectId));
  }
}
