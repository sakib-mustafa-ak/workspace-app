import { sql } from 'drizzle-orm';
import {
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
  UPDATED_AT,
} from '../common.js';
import { workspaceStatusEnum } from '../enums/workspace.enums.js';
import { users } from '../users/user.schema.js';

import {
  workspaceAlias,
  workspacesTableName,
  WORKSPACE_NAME_MAX_LENGTH,
  WORKSPACE_NAME_MIN_LENGTH,
  WORKSPACE_SLUG_MAX_LENGTH,
  WORKSPACE_SLUG_PATTERN,
} from './workspace.constants.js';

/**
 * Workspace aggregate root.
 *
 * The workspace is the multi-tenancy boundary: every collaborative
 * resource ultimately rolls up here. Part IV-B requires an explicit
 * `owner` reference (the only user-member that cannot be removed); we
 * store it as a FK to `users.id` so transfers can happen by UPDATE
 * without an extra table.
 *
 * Slug rules (enforced both in app-layer & DB):
 *   - lowercase, digits, dashes
 *   - starts + ends with alnum (no leading/trailing dash)
 *   - length between 1 and 32
 *
 * `ARCHIVED` / `DELETED` only mutate `status`; both soft-delete
 * (`deletedAt`) and the temporal status row are tracked.
 */
export const workspaces = pgTable(
  workspacesTableName,
  {
    id: PRIMARY_ID(),

    name: text('name').notNull(),
    slug: text('slug').notNull(),

    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    status: workspaceStatusEnum('status').notNull().default('ACTIVE'),

    description: text('description'),
    logoUrl: text('logo_url'),
    website: text('website'),

    settings: text('settings'),

    archivedAt: timestamp('archived_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    workspacesSlugUnique: uniqueIndex('workspaces_slug_unique_idx')
      .on(table.slug)
      .where(sql`deleted_at IS NULL`),
    workspacesOwnerIdx: index('workspaces_owner_idx').on(table.ownerId),
    workspacesStatusIdx: index('workspaces_status_idx').on(table.status),
    workspacesNameBounds: check(
      'workspaces_name_bounds',
      sql`char_length(${table.name}) BETWEEN ${sql.raw(String(WORKSPACE_NAME_MIN_LENGTH))} AND ${sql.raw(String(WORKSPACE_NAME_MAX_LENGTH))}`,
    ),
    workspacesSlugBounds: check(
      'workspaces_slug_bounds',
      // Postgres' regex operator requires a string quoting its regex.
      // Drizzle's `sql.raw` interpolates the pattern verbatim; we wrap
      // it in single quotes so the resulting CHECK constraint is
      // syntactically valid.
      sql`char_length(${table.slug}) <= ${sql.raw(String(WORKSPACE_SLUG_MAX_LENGTH))} AND ${table.slug} ~ ${sql.raw(`'${WORKSPACE_SLUG_PATTERN.source}'`)}`,
    ),
    workspacesArchivedAtConsistency: check(
      'workspaces_archived_at_consistency',
      sql`(${table.archivedAt} IS NULL) OR (${table.status} IN ('ARCHIVED', 'DELETED'))`,
    ),
  }),
);

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspaceRow = typeof workspaces.$inferInsert;

export const workspaceAccess = {
  table: workspaces,
  alias: workspaceAlias,
};
