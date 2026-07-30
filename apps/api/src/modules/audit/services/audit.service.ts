import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Db, type NewAuditEventRow } from '@repo/database';

import { AuditRepository } from '../repositories/audit.repository';
import { AUDIT_PAGE_SIZE } from '../audit.constants';
import type { ActivityQueryDto } from '../dto/activity-query.dto';

@Injectable()
export class AuditService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(AuditRepository) private readonly repo: AuditRepository,
  ) {}

  public async record(event: NewAuditEventRow): Promise<void> {
    // fire-and-forget: never block the caller
    await this.repo.create(event).catch(() => {});
  }

  public async getWorkspaceActivity(
    workspaceId: string,
    query: ActivityQueryDto,
  ) {
    return this.repo.listByWorkspace(workspaceId, {
      cursor: query.cursor,
      limit: AUDIT_PAGE_SIZE,
      action: query.action,
      resourceType: query.resourceType,
    });
  }
}
