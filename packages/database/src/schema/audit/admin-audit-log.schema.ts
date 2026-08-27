import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { CREATED_AT, PRIMARY_ID } from '../common.js';
import { users } from '../users/user.schema.js';

import {
  adminAuditLogAlias,
  adminAuditLogTableName,
} from './admin-audit-log.constants.js';

/**
 * Platform-level admin audit trail. Deliberately NOT tied to a
 * `workspaceId` — admins act across tenants — so it is a sibling of
 * `audit_events`, not a special case of it.
 */
export const adminAuditLog = pgTable(
  adminAuditLogTableName,
  {
    id: PRIMARY_ID(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: CREATED_AT(),
  },
  (table) => ({
    adminAuditActorIdx: index('admin_audit_actor_idx').on(table.actorId),
    adminAuditTargetIdx: index('admin_audit_target_idx').on(
      table.targetType,
      table.targetId,
    ),
    adminAuditCreatedAtIdx: index('admin_audit_created_at_idx').on(
      table.createdAt,
    ),
  }),
);

export type AdminAuditLogRow = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogRow = typeof adminAuditLog.$inferInsert;

export const adminAuditLogAccess = {
  table: adminAuditLog,
  alias: adminAuditLogAlias,
};