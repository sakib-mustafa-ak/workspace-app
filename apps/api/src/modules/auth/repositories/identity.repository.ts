import { Inject, Injectable } from '@nestjs/common';
import {
  DATABASE,
  eq,
  identities,
  type Db,
  type IdentityRow,
  sql,
} from '@repo/database';

/**
 * Identity aggregate persistence adapter (auth context).
 *
 * Identities are how a user authenticates against a provider. The
 * Users module never reads from this table — it only registers a user
 * for the auth context to mirror.
 */
@Injectable()
export class IdentityRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async createEmailIdentity(
    userId: string,
    providerUserId: string,
    passwordHash: string,
  ): Promise<IdentityRow> {
    const now = new Date();
    const [row] = await this.db
      .insert(identities)
      .values({
        userId,
        provider: 'EMAIL',
        providerUserId,
        passwordHash,
        isPrimary: true,
        lastUsedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error('Failed to insert EMAIL identity.');
    }
    return row;
  }

  public async findEmailIdentityForUser(
    userId: string,
  ): Promise<IdentityRow | undefined> {
    const [row] = await this.db
      .select()
      .from(identities)
      .where(
        sql`${identities.userId} = ${userId} AND ${identities.provider} = 'EMAIL' AND ${identities.deletedAt} IS NULL`,
      )
      .limit(1);
    return row;
  }

  /**
   * Mark the matching EMAIL identity as just-used. We treat `lastUsedAt`
   * as the password-rotation prompt — if the user logged in long ago,
   * the email provider (future) can decide to force a re-verification.
   */
  public async touchLastUsed(identityId: string): Promise<void> {
    await this.db
      .update(identities)
      .set({ lastUsedAt: new Date() })
      .where(eq(identities.id, identityId));
  }
}
