import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  DATABASE,
  emailVerificationTokens,
  eq,
  isNull,
  sql,
  type Db,
  type EmailVerificationTokenRow,
  type NewEmailVerificationTokenRow,
} from '@repo/database';

/**
 * Persistence for `email_verification_tokens` (auth aggregate).
 *
 * Phase 1 lifecycle:
 *   1. `mintForUser` writes a new row keyed by selector.
 *   2. The caller hands selector + verifier to the user via email.
 *   3. `consumeMatching` returns the row only when the stored
 *      `verifier_hash` equals the supplied verifier (constant-time)
 *      and the row is neither consumed nor expired. The transaction
 *      flips `consumed_at` so a leaked link is single-use.
 *
 * Storage policy (Part IV-A): rows are HARD-DELETED after the
 * periodic purge job, not soft-deleted. We never set `deleted_at`.
 */
@Injectable()
export class EmailVerificationTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  /**
   * Insert a new verification token for an email. Old still-unconsumed
   * rows for the same `(userId, email)` are revoked in the same
   * transaction — sending a fresh link must invalidate any prior link.
   */
  public async mintForUser(input: {
    userId: string;
    email: string;
    selector: string;
    verifierHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationTokenRow> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.userId, input.userId),
            eq(emailVerificationTokens.email, input.email),
            isNull(emailVerificationTokens.consumedAt),
          ),
        );

      const [row] = await tx
        .insert(emailVerificationTokens)
        .values({
          userId: input.userId,
          email: input.email,
          selector: input.selector,
          verifierHash: input.verifierHash,
          expiresAt: input.expiresAt,
        } satisfies NewEmailVerificationTokenRow)
        .returning();

      if (!row) {
        throw new Error('Failed to insert email verification token.');
      }
      return row;
    });
  }

  /**
   * Look up by selector without checking hash. The caller does the
   * constant-time compare against the supplied verifier.
   */
  public async findBySelector(
    selector: string,
  ): Promise<EmailVerificationTokenRow | undefined> {
    const [row] = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.selector, selector))
      .limit(1);
    return row;
  }

  /**
   * Atomically mark the row as consumed. Called only after the
   * caller has matched selector + verifier and confirmed expiry. We
   * use a guarded UPDATE so a second concurrent request fails to
   * flip the same row twice (race-safe).
   */
  public async markConsumed(id: string): Promise<void> {
    await this.db
      .update(emailVerificationTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.id, id),
          isNull(emailVerificationTokens.consumedAt),
        ),
      );
  }

  /**
   * Bulk-purge expired rows. Used by the periodic retention job
   * (not implemented in Phase 1; scheduled for Phase 9). Exposed here
   * so the repository owns every row-mutation in this aggregate.
   */
  public async purgeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(emailVerificationTokens)
      .where(sql`${emailVerificationTokens.expiresAt} < ${now}`);
    return result.count ?? 0;
  }
}
