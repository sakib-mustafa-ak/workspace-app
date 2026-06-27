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
import { invitationStatusEnum } from '../enums/invitation.enums.js';
import { workspaceRoleEnum } from '../enums/workspace.enums.js';
import { users } from '../users/user.schema.js';

import { workspaces } from './workspace.schema.js';
import {
  invitationAlias,
  invitationsTableName,
} from './workspace.constants.js';

/**
 * Workspace invitation (Part V-B "Invitation Entity").
 *
 * A temporary bridge between a workspace and a future member. The
 * token model follows the canonical pattern:
 *   - `selector`        : public, indexes via unique index.
 *   - `verifier_hash`   : SHA-256 over `selector+verifier`.
 *   - Plain email       : needed for the search path and to re-issue.
 *
 * Invitations are NOT soft-deleted per IV-A. Once `ACCEPTED`, `EXPIRED`
 * or `REVOKED` they are kept for audit then purged by a sweep job.
 */
export const invitations = pgTable(
  invitationsTableName,
  {
    id: PRIMARY_ID(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    /** The invitee email at the time of invitation. */
    email: text('email').notNull(),

    /** Optional FK if the invitee already has an account. */
    inviteeId: uuid('invitee_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    role: workspaceRoleEnum('role').notNull().default('VIEWER'),

    status: invitationStatusEnum('status').notNull().default('PENDING'),

    selector: text('selector').notNull(),
    verifierHash: text('verifier_hash').notNull(),

    invitedById: uuid('invited_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    acceptedById: uuid('accepted_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    acceptedAt: timestamp('accepted_at', {
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
    invitationsSelectorUnique: uniqueIndex(
      'invitations_selector_unique_idx',
    ).on(table.selector),
    invitationsWorkspaceIdx: index('invitations_workspace_idx').on(
      table.workspaceId,
    ),
    invitationsEmailIdx: index('invitations_email_idx').on(table.email),
    invitationsStatusIdx: index('invitations_status_idx').on(
      table.status,
    ),
    invitationsExpiresAtIdx: index('invitations_expires_at_idx').on(
      table.expiresAt,
    ),
    invitationsPendingByWorkspaceEmail: index(
      'invitations_pending_by_workspace_email_idx',
    )
      .on(table.workspaceId, table.email)
      .where(sql`status = 'PENDING'`),
  }),
);

export type InvitationRow = typeof invitations.$inferSelect;
export type NewInvitationRow = typeof invitations.$inferInsert;

export const invitationAccess = {
  table: invitations,
  alias: invitationAlias,
};
