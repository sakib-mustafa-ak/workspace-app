import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  desc,
  eq,
  lt,
  or,
  type Db,
  type NewAuditEventRow,
  type AuditEventRow,
  type SQL,
  auditEvents,
} from '@repo/database';

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewAuditEventRow): Promise<AuditEventRow> {
    const [created] = await this.db.insert(auditEvents).values(row).returning();
    if (!created) throw new Error('Failed to insert audit event.');
    return created;
  }

  public async listByWorkspace(
    workspaceId: string,
    opts: {
      cursor?: string;
      limit: number;
      action?: string;
      resourceType?: string;
    },
  ): Promise<{ data: AuditEventRow[]; nextCursor: string | null }> {
    const { limit, action, resourceType } = opts;
    const conditions = [eq(auditEvents.workspaceId, workspaceId)];

    if (opts.cursor) {
      // Composite keyset cursor "createdAt:id" — a plain createdAt cursor
      // skips every row sharing the boundary timestamp with the last row of
      // the previous page (audit writes frequently share a millisecond).
      const [ts, id] = opts.cursor.split(':');
      const cursorTime = new Date(ts);
      conditions.push(
        id
          ? (or(
              lt(auditEvents.createdAt, cursorTime),
              and(
                eq(auditEvents.createdAt, cursorTime),
                lt(auditEvents.id, id),
              ),
            ) as SQL)
          : lt(auditEvents.createdAt, cursorTime),
      );
    }
    if (action) conditions.push(eq(auditEvents.action, action));
    if (resourceType)
      conditions.push(eq(auditEvents.resourceType, resourceType));

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    return {
      data: rows,
      nextCursor:
        hasMore && rows.length > 0
          ? `${rows[rows.length - 1].createdAt.toISOString()}:${rows[rows.length - 1].id}`
          : null,
    };
  }

  public async listByUser(
    userId: string,
    limit: number,
  ): Promise<AuditEventRow[]> {
    return this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.userId, userId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
  }

  public async listAllByWorkspace(
    workspaceId: string,
  ): Promise<AuditEventRow[]> {
    return this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, workspaceId))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
  }
}
