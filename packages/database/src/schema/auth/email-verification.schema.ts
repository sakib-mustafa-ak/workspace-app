import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import { users } from '../users/user.schema.js';

import { emailVerificationTokensTableName } from './auth.constants.js';

/**
 * Email-verification token (auth aggregate, supporting).
 *
 * Sent at registration (and resend) to verify the user controls the
 * primary email on their account. The blueprint is explicit:
 * - Tokens are stored as `selector + verifier-hash` (NEVER the verifier).
 * - This row is hard-deleted after consumption or expiry per IV-A's
 *   "soft delete strategy" table for password resets / verification codes.
 *
 * `verifiedAt` is also mirrored into `users.email_verified_at` for
 * cheap reads; the source of truth lives on the user, this table only
 * proves a valid token was used once.
 */
export const emailVerificationTokens = pgTable(
  emailVerificationTokensTableName,
  {
    id: PRIMARY_ID(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Email address the verification was issued for. */
    email: text('email').notNull(),

    selector: text('selector').notNull(),
    verifierHash: text('verifier_hash').notNull(),

    consumedAt: timestamp('consumed_at', {
      withTimezone: true,
      mode: 'date',
    }),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    emailVerificationSelectorUnique: uniqueIndex(
      'email_verification_tokens_selector_unique_idx',
    ).on(table.selector),
    emailVerificationUserIdx: index(
      'email_verification_tokens_user_idx',
    ).on(table.userId),
    emailVerificationEmailIdx: index(
      'email_verification_tokens_email_idx',
    ).on(table.email),
    emailVerificationExpiresAtIdx: index(
      'email_verification_tokens_expires_at_idx',
    ).on(table.expiresAt),
    emailVerificationActiveIdx: index(
      'email_verification_tokens_active_idx',
    ).on(table.userId)
      .where(sql`consumed_at IS NULL`),
  }),
);

export type EmailVerificationTokenRow =
  typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationTokenRow =
  typeof emailVerificationTokens.$inferInsert;
