import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  DELETED_AT,
  PRIMARY_ID,
} from '../common.js';
import { identityProviderEnum } from '../enums/identity.enums.js';
import { users } from '../users/user.schema.js';

import {
  identitiesTableName,
  identityAlias,
} from './auth.constants.js';

/**
 * Identity = `User × Provider` binding.
 *
 * A user with an email + password has one `EMAIL` identity. A user who
 * later signs in with Google gains a `GOOGLE` identity. The aggregate
 * root of authentication is the *user*, not the identity; this table
 * exists only to authorize.
 *
 * Design notes:
 *  - The provider's external id (e.g. Google `sub`) lives in
 *    `providerUserId` and is unique per (provider, providerUserId).
 *  - Password hashes MUST go here, not on `users`. Rotating the hash
 *    algorithm or removing a credential should never require a schema
 *    migration.
 *  - The primary flag supports the (future) "last used" identity hints
 *    while keeping `users.email` canonical.
 */
export const identities = pgTable(
  identitiesTableName,
  {
    id: PRIMARY_ID(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    provider: identityProviderEnum('provider').notNull(),
    providerUserId: text('provider_user_id'), // null only for EMAIL.

    emailForOAuth: text('email_for_oauth'),
    passwordHash: text('password_hash'), // null for non-EMAIL identities.

    isPrimary: boolean('is_primary').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    identitiesUserProviderUnique: uniqueIndex(
      'identities_user_provider_unique_idx',
    )
      .on(table.userId, table.provider)
      .where(sql`deleted_at IS NULL`),
    identitiesProviderUnique: uniqueIndex('identities_provider_unique_idx')
      .on(table.provider, table.providerUserId)
      .where(sql`${table.providerUserId} IS NOT NULL`),
    identitiesUserIdx: index('identities_user_idx').on(table.userId),
    identitiesProviderIdx: index('identities_provider_idx').on(
      table.provider,
    ),
    identitiesEmailFormatCheck: check(
      'identities_oauth_email_format',
      sql`email_for_oauth IS NULL OR email_for_oauth ~* '^[^@]+@[^@]+\\.[^@]+$'`,
    ),
  }),
);

export type IdentityRow = typeof identities.$inferSelect;
export type NewIdentityRow = typeof identities.$inferInsert;

export const identityAccess = {
  table: identities,
  alias: identityAlias,
};
