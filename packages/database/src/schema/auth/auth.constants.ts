/**
 * Domain-level constants for the Auth aggregate.
 *
 * Lives in `schema/auth/` (not `apps/api/`) because other contexts (Users,
 * Workspaces) need to reference these names directly. The auth module's
 * business logic still owns behavior; the schema owns namespacing only.
 */

export const identitiesTableName = 'identities';
export const sessionsTableName = 'sessions';
export const passwordResetTokensTableName = 'password_reset_tokens';
export const emailVerificationTokensTableName =
  'email_verification_tokens';

export const identityAlias = 'identity';
export const sessionAlias = 'session';
