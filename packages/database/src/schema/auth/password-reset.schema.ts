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

import { passwordResetTokensTableName } from './auth.constants.js';

/**
 * Password-reset token (auth aggregate, supporting).
 *
 * Tokens are short-lived (default 1h), opaque, and stored as hashes —
 * the plaintext version is only ever placed in the email the user
 * receives. The row is hard-deleted after consumption OR expiry per
 * the IV-A "soft-delete policy" table.
 *
 * `selector + verifier` is the canonical pattern for safe lookup
 * without exposing the verifier: the verifier is hashed, the selector
 * is searched by exact match (and is unique), and the comparer is
 * constant-time on the verifier.
 */
export const passwordResetTokens = pgTable(
  passwordResetTokensTableName,
  {
    id: PRIMARY_ID(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Public, unique identifier used to look the row up. */
    selector: text('selector').notNull(),
    /** SHA-256 of `{selector}:{verifier}` — never the verifier itself. */
    verifierHash: text('verifier_hash').notNull(),

    requestedFromIp: text('requested_from_ip'),
    userAgent: text('user_agent'),

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
    passwordResetSelectorUnique: uniqueIndex(
      'password_reset_tokens_selector_unique_idx',
    ).on(table.selector),
    passwordResetUserIdx: index('password_reset_tokens_user_idx').on(
      table.userId,
    ),
    /** Lookup for the periodic purge job. */
    passwordResetExpiresAtIdx: index(
      'password_reset_tokens_expires_at_idx',
    ).on(table.expiresAt),
    passwordResetActiveIdx: index(
      'password_reset_tokens_active_idx',
    ).on(table.userId)
      .where(sql`consumed_at IS NULL`),
  }),
);

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetTokenRow = typeof passwordResetTokens.$inferInsert;
