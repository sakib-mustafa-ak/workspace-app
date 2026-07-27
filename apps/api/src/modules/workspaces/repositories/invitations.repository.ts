import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  lt,
  sql,
  type Db,
  type InvitationRow,
  type NewInvitationRow,
  invitations,
} from '@repo/database';

@Injectable()
export class InvitationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewInvitationRow): Promise<InvitationRow> {
    const [created] = await this.db.insert(invitations).values(row).returning();
    if (!created) throw new Error('Failed to create invitation.');
    return created;
  }

  public async findBySelector(
    selector: string,
  ): Promise<InvitationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.selector, selector))
      .limit(1);
    return row;
  }

  public async listByWorkspace(workspaceId: string): Promise<InvitationRow[]> {
    return this.db
      .select()
      .from(invitations)
      .where(eq(invitations.workspaceId, workspaceId))
      .orderBy(invitations.createdAt);
  }

  public async findPendingByEmail(
    workspaceId: string,
    email: string,
  ): Promise<InvitationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          sql`lower(${invitations.email}) = lower(${email})`,
          eq(invitations.status, 'PENDING'),
        ),
      )
      .limit(1);
    return row;
  }

  public async accept(id: string, userId: string): Promise<void> {
    await this.db
      .update(invitations)
      .set({
        status: 'ACCEPTED',
        acceptedById: userId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, id));
  }

  public async revoke(id: string): Promise<void> {
    await this.db
      .update(invitations)
      .set({
        status: 'REVOKED',
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, id));
  }

  public async expireStale(): Promise<number> {
    const result = await this.db
      .update(invitations)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(
        and(
          eq(invitations.status, 'PENDING'),
          lt(invitations.expiresAt, new Date()),
        ),
      );
    return result.count ?? 0;
  }

  public async countPendingByWorkspace(workspaceId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          eq(invitations.status, 'PENDING'),
        ),
      );
    return Number(result.count);
  }
}
