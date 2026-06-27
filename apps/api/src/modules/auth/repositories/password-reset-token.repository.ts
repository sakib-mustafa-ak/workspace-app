import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  DATABASE,
  eq,
  isNull,
  passwordResetTokens,
  sql,
  type Db,
  type NewPasswordResetTokenRow,
  type PasswordResetTokenRow,
} from '@repo/database';

/**
 * Persistence for `password_reset_tokens` (auth aggregate).
 *
 * Mirror of `EmailVerificationTokenRepository`. Rows are HARD-deleted
 * by a periodic purge job (not implemented in Phase 1; scheduled for
 * Phase 9) per Part IV-A "Soft Delete Rules".
 */
@Injectable()
export class PasswordResetTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  /**
   * Insert a fresh reset token and revoke any still-unconsumed rows
   * for the same user — sending a new link must always invalidate
   * the prior one. Done in a single transaction so the revocation
   * is all-or-nothing with the insert.
   *
   * The schema does not carry an explicit `email` column (the link
   * arrives at the user's mailbox independent of database state),
   * so we lack the per-email revocation pair verification enjoys —
   * but the per-user revocation is just as effective against any
   * leak.
   */
  public async mintForUser(input: {
    userId: string;
    selector: string;
    verifierHash: string;
    requestedFromIp: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRow> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, input.userId),
            isNull(passwordResetTokens.consumedAt),
          ),
        );

      const [row] = await tx
        .insert(passwordResetTokens)
        .values({
          userId: input.userId,
          selector: input.selector,
          verifierHash: input.verifierHash,
          requestedFromIp: input.requestedFromIp,
          userAgent: input.userAgent,
          expiresAt: input.expiresAt,
        } satisfies NewPasswordResetTokenRow)
        .returning();

      if (!row) {
        throw new Error('Failed to insert password reset token.');
      }
      return row;
    });
  }

  /** Look up by selector without checking the verifier hash. */
  public async findBySelector(
    selector: string,
  ): Promise<PasswordResetTokenRow | undefined> {
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.selector, selector))
      .limit(1);
    return row;
  }

  /** Race-safe consume: guard on `consumed_at IS NULL`. */
  public async markConsumed(id: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.id, id),
          isNull(passwordResetTokens.consumedAt),
        ),
      );
  }

  /** Periodic purge; not currently invoked. Exposed for future workers. */
  public async purgeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < ${now}`);
    return result.count ?? 0;
  }
}
