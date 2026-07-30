import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  desc,
  eq,
  lt,
  type Db,
  type NewAuditEventRow,
  type AuditEventRow,
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
      conditions.push(lt(auditEvents.createdAt, new Date(opts.cursor)));
    }
    if (action) conditions.push(eq(auditEvents.action, action));
    if (resourceType)
      conditions.push(eq(auditEvents.resourceType, resourceType));

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    return {
      data: rows,
      nextCursor:
        hasMore && rows.length > 0
          ? rows[rows.length - 1].createdAt.toISOString()
          : null,
    };
  }
}
