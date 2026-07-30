import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { CREATED_AT, PRIMARY_ID } from '../common.js';
import { workspaces } from '../workspaces/workspace.schema.js';
import { users } from '../users/user.schema.js';
import { auditEventAlias, auditEventsTableName } from './audit.constants.js';

export const auditEvents = pgTable(
  auditEventsTableName,
  {
    id: PRIMARY_ID(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: CREATED_AT(),
  },
  (table) => ({
    auditWorkspaceCreatedAtIndex: index('audit_workspace_created_at_idx').on(table.workspaceId, table.createdAt),
    auditActionIdx: index('audit_action_idx').on(table.action),
    auditResourceTypeIdx: index('audit_resource_type_idx').on(table.resourceType),
  }),
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;

export const auditEventAccess = { table: auditEvents, alias: auditEventAlias };
