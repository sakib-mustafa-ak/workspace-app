import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Workspace statuses.
 *
 * `ARCHIVED` is a first-class terminal state: members can still see the
 * workspace, but every board is read-only until restored. We model
 * archiving instead of hard deletion because the blueprint makes it
 * explicit that "Deletion should rarely be immediate. Prefer archival."
 */
export const workspaceStatusEnum = pgEnum('workspace_status', [
  'ACTIVE',
  'ARCHIVED',
  'DELETED',
]);

export type WorkspaceStatus =
  (typeof workspaceStatusEnum.enumValues)[number];

/**
 * Membership roles (RBAC).
 *
 * Hierarchy (lowest → highest):
 *   VIEWER < COMMENTER < EDITOR < ADMIN < OWNER
 *
 * Authorization decisions live in policies. Code never compares role
 * strings directly — it asks a `Policy` (see Part V-B "Permission
 * Philosophy").
 *
 * Future enterprise roles (Org Owner, Dept Admin, ...) extend the
 * registry without breaking this enum.
 */
export const workspaceRoleEnum = pgEnum('workspace_role', [
  'VIEWER',
  'COMMENTER',
  'EDITOR',
  'ADMIN',
  'OWNER',
]);

export type WorkspaceRole =
  (typeof workspaceRoleEnum.enumValues)[number];

/** Numeric rank used by policies for `>=` comparisons. */
export const WORKSPACE_ROLE_RANK: Readonly<Record<WorkspaceRole, number>> = {
  VIEWER: 0,
  COMMENTER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

/**
 * Membership lifecycle status.
 *
 * PENDING is reserved for the window between accepting an invitation
 * and the new member actually being active — currently identical to
 * ACTIVE because we settle both in one transaction, but the field
 * exists so future "approval required" workflows do not require a
 * schema change.
 */
export const membershipStatusEnum = pgEnum('membership_status', [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED',
]);

export type MembershipStatus =
  (typeof membershipStatusEnum.enumValues)[number];
