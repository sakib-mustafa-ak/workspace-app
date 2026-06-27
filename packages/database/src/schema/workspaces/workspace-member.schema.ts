import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
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
import {
  membershipStatusEnum,
  workspaceRoleEnum,
} from '../enums/workspace.enums.js';
import { users } from '../users/user.schema.js';

import { workspaces } from './workspace.schema.js';
import {
  workspaceMemberAlias,
  workspaceMembersTableName,
} from './workspace.constants.js';

/**
 * Workspace membership.
 *
 * Membership is its own concept (not a flag on the user, not a flag on
 * the workspace) because it carries role + status + audit fields. Part
 * V-B "Membership Philosophy" is explicit about this.
 *
 * Role invariant:
 *   - Exactly one membership per workspace carries role OWNER at any
 *     given moment. The OWNER constraint is enforced in the service
 *     layer; here we keep a non-unique partial-friendly index.
 *
 * Status invariant:
 *   - `REMOVED` is a terminal lifecycle that mirrors soft-delete; we
 *     still keep `deletedAt` to defeat the historical "membership
 *     reappears" race when inviting a past member back.
 */
export const workspaceMembers = pgTable(
  workspaceMembersTableName,
  {
    id: PRIMARY_ID(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    role: workspaceRoleEnum('role').notNull().default('VIEWER'),
    status: membershipStatusEnum('status').notNull().default('PENDING'),

    /** Nullable when `status` is PENDING; populated at acceptance time. */
    joinedAt: timestamp('joined_at', {
      withTimezone: true,
      mode: 'date',
    }),

    /** Audit: which invitation ledger entry resulted in this membership. */
    invitationId: uuid('invitation_id'),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    workspaceMembersWorkspaceUserUnique: uniqueIndex(
      'workspace_members_workspace_user_unique_idx',
    )
      .on(table.workspaceId, table.userId)
      .where(sql`deleted_at IS NULL`),
    workspaceMembersUserIdx: index('workspace_members_user_idx').on(
      table.userId,
    ),
    workspaceMembersWorkspaceIdx: index(
      'workspace_members_workspace_idx',
    ).on(table.workspaceId),
    workspaceMembersRoleIdx: index('workspace_members_role_idx').on(
      table.role,
    ),
    workspaceMembersStatusIdx: index('workspace_members_status_idx').on(
      table.status,
    ),
    workspaceMembersJoinedAtConsistency: check(
      'workspace_members_joined_at_consistency',
      sql`(${table.joinedAt} IS NOT NULL) OR (${table.status} = 'PENDING')`,
    ),
  }),
);

export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMemberRow = typeof workspaceMembers.$inferInsert;

export const workspaceMemberAccess = {
  table: workspaceMembers,
  alias: workspaceMemberAlias,
};
