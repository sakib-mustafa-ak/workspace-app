import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../client/uuid.js';

/**
 * Reusable Drizzle column presets.
 *
 * Every entity in Workspace OS exposes the same baseline columns:
 *  - `id`        — UUIDv7, default-generated client-side.
 *  - `createdAt` — UTC TIMESTAMPTZ, defaulted to `now()`.
 *  - `updatedAt` — UTC TIMESTAMPTZ, defaulted to `now()` and refreshed
 *                  in code at every write.
 *
 * The patterns here are intentionally narrow. Anything more elaborate
 * belongs to the owning schema file so common stays a leaf.
 */

export const PRIMARY_ID = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())
    .notNull();

export const CREATED_AT = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow();

export const UPDATED_AT = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow();

/**
 * Append `updated_at = NOW()` to a SQL fragment.
 *
 * Wired into repository `update` statements via Drizzle's `.returning()`
 * so writers stay DRY without losing SQL transparency.
 */
export const TOUCH_UPDATED_AT_SQL = sql`updated_at = NOW()`;

/**
 * Soft-delete marker. Used selectively (workspace, board, comment).
 *
 * Persistence convention:
 *  - `null`     : live
 *  - timestamp  : archived (never truly deleted)
 */
export const DELETED_AT = () =>
  timestamp('deleted_at', { withTimezone: true, mode: 'date' });

/**
 * Foreign-key ID column generator.
 *
 * Always pairs with `.references(() => referenced.id, { onDelete: 'restrict' })`.
 * Cascading is the owning module's responsibility (see blueprint rule
 * "Never blindly use ON DELETE CASCADE").
 */
export const REFERENCE_ID = (name: string) =>
  uuid(name)
    .$defaultFn(() => uuidv7())
    .notNull();
