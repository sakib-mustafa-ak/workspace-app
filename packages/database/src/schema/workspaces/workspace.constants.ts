/**
 * Domain-level constants for the Workspaces aggregate.
 *
 * These names are the source of truth shared across schema, repositories,
 * services, and tests. Touching this file changes the database surface.
 */

export const workspacesTableName = 'workspaces';
export const workspaceMembersTableName = 'workspace_members';
export const invitationsTableName = 'workspace_invitations';

export const workspaceAlias = 'workspace';
export const workspaceMemberAlias = 'workspace_member';
export const invitationAlias = 'invitation';

export const WORKSPACE_NAME_MIN_LENGTH = 2;
export const WORKSPACE_NAME_MAX_LENGTH = 60;
export const WORKSPACE_SLUG_MAX_LENGTH = 32;
export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export const DEFAULT_INVITATION_TTL_DAYS = 7;
export const MAX_PENDING_INVITATIONS_PER_WORKSPACE = 200;
