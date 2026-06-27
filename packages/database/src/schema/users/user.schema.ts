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
  DELETED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import { userStatusEnum } from '../enums/auth.enums.js';

import { usersTableName } from './users.constants.js';

/**
 * Users aggregate root.
 *
 * Owns identity-defining fields (display name, primary email) and account
 * status. Authentication concerns (password hashes, refresh tokens) live
 * in `auth/identity.schema.ts` so the Users domain never depends on
 * authentication outcomes.
 *
 * The matching index on the email unique constraint is added so the
 * email column becomes an efficient lookup target even though
 * uniqueness is already enforced via the unique index.
 */
export const users = pgTable(
  usersTableName,
  {
    id: PRIMARY_ID(),

    displayName: text('display_name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),

    status: userStatusEnum('status').notNull().default('ACTIVE'),

    // Optional profile fields — never free-text JSON; relational.
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    timezone: text('timezone'),
    locale: text('locale'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    emailVerifiedAt: timestamp('email_verified_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    usersEmailUnique: uniqueIndex('users_email_unique_idx').on(
      table.email,
    ),
    usersStatusIdx: index('users_status_idx').on(table.status),
    usersCreatedAtIdx: index('users_created_at_idx').on(
      table.createdAt,
    ),
  }),
);

// drizzle's recommended column-extract type — handy for repositories.
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/**
 * Public column tuple used by repositories that hydrate user records
 * without spilling internal fields.
 */
export const PUBLIC_USER_COLUMNS = {
  id: users.id,
  displayName: users.displayName,
  email: users.email,
  avatarUrl: users.avatarUrl,
  bio: users.bio,
  timezone: users.timezone,
  locale: users.locale,
  status: users.status,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;
