import type { UserStatus } from '@repo/database';

/**
 * Authenticated user seen by controllers/services.
 *
 * Populated by `JwtAuthGuard` from the verified access token plus a
 * small DB lookup. Interface lives in `interfaces/` so downstream
 * modules can import the shape without depending on the guard /
 * decorator implementation.
 */
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
}
