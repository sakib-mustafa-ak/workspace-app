import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Db, adminAuditLog } from '@repo/database';

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
}
