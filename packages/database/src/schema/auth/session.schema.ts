import {
  index,
  inet,
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

import { sessionsTableName, sessionAlias } from './auth.constants.js';

export type JsonWebKey = {
  kty: string;
  kid: string;
  alg: string;
  use: 'sig';
  n?: string;
  e?: string;
} & Record<string, unknown>;

const JSONB_KEYS_COLUMN_NAME = 'public_keys';

/**
 * Refresh-token session (auth aggregate).
 *
 * A `session` represents one trusted login on one device. Each session
 * owns exactly one refresh token whose plain value never lives in the
 * database — only its SHA-256 hash. Sessions are NOT soft-deleted per
 * the IV-A schedule ("Do NOT use soft deletes for Session").
 *
 * Lifecycle:
 *   1. Created on login.
 *   2. Refreshed on every token rotation.
 *   3. `revoked_at` set on explicit logout (or compromised-device purge).
 *   4. Physically purged by a periodic retention job after expiry.
 *
 * `publicKeys` is reserved for future WebAuthn / passkey support and
 * kept here so we do not need a migration to introduce it.
 */
export const sessions = pgTable(
  sessionsTableName,
  {
    id: PRIMARY_ID(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Salted hash (SHA-256 over refresh+credential-id+salt). */
    refreshTokenHash: text('refresh_token_hash').notNull(),

    /** Device label as reported by the client. */
    deviceName: text('device_name'),
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),

    /** Future-proofing: zero or more WebAuthn / passkey credentials. */
    publicKeys: text(JSONB_KEYS_COLUMN_NAME),

    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'date',
    }),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    sessionsRefreshTokenUnique: uniqueIndex(
      'sessions_refresh_token_hash_unique_idx',
    ).on(table.refreshTokenHash),
    sessionsUserIdx: index('sessions_user_idx').on(table.userId),
    sessionsExpiresAtIdx: index('sessions_expires_at_idx').on(
      table.expiresAt,
    ),
  }),
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

export const sessionAccess = {
  table: sessions,
  alias: sessionAlias,
};
