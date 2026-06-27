import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Account status (auth/users aggregate).
 *
 * Stored as enums rather than parallel booleans (`is_active`,
 * `is_suspended`, `is_deleted`) — see IV-A "Boolean Guidelines".
 */
export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'DELETED',
]);

export type UserStatus = (typeof userStatusEnum.enumValues)[number];
