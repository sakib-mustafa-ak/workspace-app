import { Inject, Injectable } from '@nestjs/common';
import { boardVisibleTo } from '../../../common/board-access/board-visibility';

import {
  and,
  DATABASE,
  desc,
  eq,
  inArray,
  sql,
  type Db,
  type NewNotificationRow,
  type NotificationRow,
  notifications,
  boards,
  tasks,
} from '@repo/database';

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async canReceive(
    userId: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<boolean> {
    if (!resourceId || !['board', 'task'].includes(resourceType ?? ''))
      return true;
    if (resourceType === 'board') {
      return (
        (
          await this.db
            .select({ id: boards.id })
            .from(boards)
            .where(
              and(eq(boards.id, resourceId), boardVisibleTo(userId, boards.id)),
            )
            .limit(1)
        ).length > 0
      );
    }
    return (
      (
        await this.db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.id, resourceId),
              boardVisibleTo(userId, tasks.boardId),
            ),
          )
          .limit(1)
      ).length > 0
    );
  }

  private visible(userId: string) {
    return sql`(${notifications.resourceType} IS NULL OR ${notifications.resourceType} NOT IN ('board', 'task') OR
      (${notifications.resourceType} = 'board' AND EXISTS (SELECT 1 FROM boards notification_board WHERE notification_board.id::text = ${notifications.resourceId} AND ${boardVisibleTo(userId, sql`notification_board.id`)})) OR
      (${notifications.resourceType} = 'task' AND EXISTS (SELECT 1 FROM tasks notification_task WHERE notification_task.id::text = ${notifications.resourceId} AND ${boardVisibleTo(userId, sql`notification_task.board_id`)})))`;
  }

  public async create(row: NewNotificationRow): Promise<NotificationRow> {
    const [created] = await this.db
      .insert(notifications)
      .values(row)
      .returning();
    if (!created) throw new Error('Failed to create notification.');
    return created;
  }

  public async findById(
    id: string,
    userId: string,
  ): Promise<NotificationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          this.visible(userId),
          sql`${notifications.archivedAt} IS NULL`,
        ),
      )
      .limit(1);
    return row;
  }

  public async listByUser(
    userId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<NotificationRow[]> {
    const { limit = 50, offset = 0 } = opts;
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          this.visible(userId),
          sql`${notifications.archivedAt} IS NULL`,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  public async countUnread(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.status, 'DELIVERED'),
          sql`${notifications.archivedAt} IS NULL`,
          sql`${notifications.readAt} IS NULL`,
          this.visible(userId),
        ),
      );
    return Number(result?.count ?? 0);
  }

  public async markAsRead(
    id: string,
    userId: string,
  ): Promise<NotificationRow> {
    const [updated] = await this.db
      .update(notifications)
      .set({
        status: 'READ',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          sql`${notifications.archivedAt} IS NULL`,
        ),
      )
      .returning();
    if (!updated) throw new Error('Failed to mark notification as read.');
    return updated;
  }

  public async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({
        status: 'READ',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, userId),
          // CREATED rows (e.g. delivery not yet flushed) must be readable too —
          // otherwise "mark all read" silently no-ops for them.
          inArray(notifications.status, ['CREATED', 'DELIVERED']),
          sql`${notifications.readAt} IS NULL`,
          sql`${notifications.archivedAt} IS NULL`,
        ),
      );
  }

  public async archive(id: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          sql`${notifications.archivedAt} IS NULL`,
        ),
      );
  }

  public async deliver(id: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({
        status: 'DELIVERED',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(notifications.id, id), eq(notifications.status, 'CREATED')),
      );
  }

  public async totalCount(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${notifications.archivedAt} IS NULL`,
        ),
      );
    return Number(result?.count ?? 0);
  }
}
