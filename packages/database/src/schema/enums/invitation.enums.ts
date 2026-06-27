import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Invitation lifecycle (Part V-B "Invitation Lifecycle").
 *
 * `Created → Sent → Accepted | Expired | Revoked`
 *
 * Expired and Revoked are terminal states; once a token is consumed
 * the row is hard-deleted on the next sweep so audit trails remain
 * compact.
 */
export const invitationStatusEnum = pgEnum('invitation_status', [
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED',
]);

export type InvitationStatus =
  (typeof invitationStatusEnum.enumValues)[number];
