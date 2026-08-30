import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  adminAuditLog,
  DATABASE,
  desc,
  eq,
  gte,
  lte,
  type AdminAuditLogRow,
  type Db,
  type SQL,
} from '@repo/database';

export type AdminAuditFilters = {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class AdminAuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async record(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.insert(adminAuditLog).values({
      actorId,
      action,
      targetType,
      targetId,
      metadata,
    });
  }

  public async list(
    filters: AdminAuditFilters = {},
  ): Promise<AdminAuditLogRow[]> {
    const conditions: SQL[] = [];

    if (filters.actorId)
      conditions.push(eq(adminAuditLog.actorId, filters.actorId));

    if (filters.action)
      conditions.push(eq(adminAuditLog.action, filters.action));

    const from = filters.from ? new Date(filters.from) : undefined;
    if (from && !Number.isNaN(from.getTime())) {
      conditions.push(gte(adminAuditLog.createdAt, from));
    }

    const to = filters.to ? new Date(filters.to) : undefined;
    if (to && !Number.isNaN(to.getTime())) {
      conditions.push(lte(adminAuditLog.createdAt, to));
    }

    return this.db
      .select()
      .from(adminAuditLog)
      .where(and(...conditions))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(50);
  }
}
