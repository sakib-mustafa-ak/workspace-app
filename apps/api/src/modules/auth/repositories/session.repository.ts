import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  DATABASE,
  eq,
  isNull,
  sessions,
  type Db,
  type NewSessionRow,
  type SessionRow,
} from '@repo/database';

/**
 * Session aggregate persistence adapter.
 *
 * Sessions are NOT soft-deleted per IV-A; revocation is a status
 * flip on `revokedAt` so the audit trail stays compact while still
 * allowing a stale-bucket cleanup process to purge binary receipts.
 */
@Injectable()
export class SessionRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async create(row: NewSessionRow): Promise<SessionRow> {
    const [created] = await this.db
      .insert(sessions)
      .values(row)
      .returning();
    if (!created) {
      throw new Error('Failed to insert session.');
    }
    return created;
  }

  public async findById(id: string): Promise<SessionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return row;
  }

  /**
   * Look a session up by its `refresh_token_hash` (already hashed by
   * the caller). Equivalent semantics: a unique index guarantees at
   * most one row.
   */
  public async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<SessionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, refreshTokenHash))
      .limit(1);
    return row;
  }

  public async touch(sessionId: string, ip: string | null, ua: string | null): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        lastUsedAt: new Date(),
        ...(ip !== null ? { ipAddress: ip } : {}),
        ...(ua !== null ? { userAgent: ua } : {}),
      })
      .where(eq(sessions.id, sessionId));
  }

  public async replaceRefreshToken(
    sessionId: string,
    newHash: string,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({ refreshTokenHash: newHash, lastUsedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  public async revoke(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(sessions.id, sessionId),
        isNull(sessions.revokedAt),
      ));
  }
}
