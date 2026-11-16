import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DATABASE,
  and,
  eq,
  sql,
  boards,
  boardColumns,
  tasks,
  checklistItems,
  workspaces,
  type Db,
  type NewTaskRow,
  type NewChecklistItemRow,
} from '@repo/database';
import { UsageService } from '../../billing/services/usage.service';
import { BoardsEventBus } from '../events/boards.events';
import { parseTrelloBoard } from './trello-parser';

@Injectable()
export class TrelloImportService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(BoardsEventBus) private readonly events: BoardsEventBus,
  ) {}

  async preview(workspaceId: string, userId: string, input: unknown) {
    await this.usage.requireWorkspaceRole(workspaceId, userId, 'EDITOR');
    return parseTrelloBoard(input).preview;
  }

  async importBoard(workspaceId: string, userId: string, input: unknown) {
    await this.usage.requireWorkspaceRole(workspaceId, userId, 'EDITOR');
    const parsed = parseTrelloBoard(input);
    const board = await this.db.transaction(async (tx) => {
      // Serialize imports to this workspace before checking quota and position.
      await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .for('update');
      // Keep these reads on the transaction connection: taking another pool
      // connection while imports wait on the workspace lock can exhaust it.
      await this.usage.requireWorkspaceRole(workspaceId, userId, 'EDITOR', tx);
      await this.usage.assertCanCreateBoard(workspaceId, tx);
      const [last] = await tx
        .select({
          position: sql<number>`coalesce(max(${boards.position}), -1)`,
        })
        .from(boards)
        .where(
          and(
            eq(boards.workspaceId, workspaceId),
            sql`${boards.deletedAt} IS NULL`,
          ),
        );
      const [created] = await tx
        .insert(boards)
        .values({
          workspaceId,
          name: parsed.name,
          description: parsed.description,
          position: Number(last?.position ?? -1) + 1,
        })
        .returning();
      if (!created) throw new Error('Failed to create imported board.');
      const taskRows: NewTaskRow[] = [];
      const itemRows: NewChecklistItemRow[] = [];
      const columnRows = parsed.columns.map((column, index) => {
        const columnId = randomUUID();
        column.cards.forEach((card, cardPosition) => {
          const taskId = randomUUID();
          taskRows.push({
            id: taskId,
            workspaceId,
            boardId: created.id,
            columnId,
            title: card.title,
            description: card.description,
            position: cardPosition,
            createdById: userId,
            status: card.done ? 'DONE' : 'TODO',
            dueDate: card.dueDate ? new Date(card.dueDate) : null,
          });
          card.items.forEach((item, itemPosition) =>
            itemRows.push({ taskId, ...item, position: itemPosition }),
          );
        });
        return {
          id: columnId,
          boardId: created.id,
          name: column.name,
          position: index,
        };
      });
      await tx.insert(boardColumns).values(columnRows);
      // Bounded batches stay below PostgreSQL's bind-parameter limit.
      for (let i = 0; i < taskRows.length; i += 200)
        await tx.insert(tasks).values(taskRows.slice(i, i + 200));
      for (let i = 0; i < itemRows.length; i += 500)
        await tx.insert(checklistItems).values(itemRows.slice(i, i + 500));
      return created;
    });
    this.events.publishBoardCreated({
      boardId: board.id,
      workspaceId,
      createdBy: userId,
    });
    return { board, preview: parsed.preview };
  }
}
