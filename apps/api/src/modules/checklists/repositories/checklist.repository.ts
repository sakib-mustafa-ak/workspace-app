import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  eq,
  type Db,
  type NewChecklistItemRow,
  type ChecklistItemRow,
  checklistItems,
} from '@repo/database';

@Injectable()
export class ChecklistRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async listByTask(taskId: string): Promise<ChecklistItemRow[]> {
    return this.db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId))
      .orderBy(checklistItems.position);
  }

  public async create(row: NewChecklistItemRow): Promise<ChecklistItemRow> {
    const [created] = await this.db
      .insert(checklistItems)
      .values(row)
      .returning();
    if (!created) throw new Error('Failed to create checklist item.');
    return created;
  }

  public async findById(id: string): Promise<ChecklistItemRow | undefined> {
    const [row] = await this.db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .limit(1);
    return row;
  }

  public async update(
    id: string,
    data: Partial<Pick<NewChecklistItemRow, 'text' | 'completed' | 'position'>>,
  ): Promise<ChecklistItemRow> {
    const [updated] = await this.db
      .update(checklistItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(checklistItems.id, id))
      .returning();
    if (!updated) throw new Error('Failed to update checklist item.');
    return updated;
  }

  public async delete(id: string): Promise<void> {
    await this.db.delete(checklistItems).where(eq(checklistItems.id, id));
  }
}
