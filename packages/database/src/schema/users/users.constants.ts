/**
 * Domain-level constants for the Users aggregate.
 *
 * What goes here?
 * - Database object names (`users`) used across the schema.
 * - Anything that must be identical in Drizzle definitions, SQL
 *   migrations, repository lookups, and tests.
 *
 * What does NOT go here?
 * - Business rules (those live in `apps/api/src/modules/users/services`).
 * - Module-internal magic numbers (those live next to their users).
 */

export const usersTableName = 'users';

export const usersIdColumn = 'id';
export const usersEmailColumn = 'email';
export const usersDisplayNameColumn = 'display_name';

export const usersAlias = 'user';
