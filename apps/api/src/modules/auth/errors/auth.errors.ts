import { HttpException } from '@nestjs/common';

/**
 * Stable machine-readable codes for the authentication domain.
 *
 * These codes are part of the public API contract — clients branch on
 * them, never on translated message strings. Adding a new code is
 * non-breaking; renaming an existing one is breaking and requires a
 * new API major version.
 */
export const AuthErrorCode = {
  EMAIL_ALREADY_EXISTS: 'AUTH.EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'AUTH.INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'AUTH.ACCOUNT_SUSPENDED',
  ACCOUNT_DELETED: 'AUTH.ACCOUNT_DELETED',
  INVALID_REFRESH_TOKEN: 'AUTH.INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_EXPIRED: 'AUTH.REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_REVOKED: 'AUTH.REFRESH_TOKEN_REVOKED',
  UNAUTHENTICATED: 'AUTH.UNAUTHENTICATED',
} as const;

export type AuthErrorCode =
  (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

const STATUS_BY_CODE: Readonly<Record<AuthErrorCode, number>> = {
  [AuthErrorCode.EMAIL_ALREADY_EXISTS]: 409,
  [AuthErrorCode.INVALID_CREDENTIALS]: 401,
  [AuthErrorCode.ACCOUNT_SUSPENDED]: 403,
  [AuthErrorCode.ACCOUNT_DELETED]: 403,
  [AuthErrorCode.INVALID_REFRESH_TOKEN]: 401,
  [AuthErrorCode.REFRESH_TOKEN_EXPIRED]: 401,
  [AuthErrorCode.REFRESH_TOKEN_REVOKED]: 401,
  [AuthErrorCode.UNAUTHENTICATED]: 401,
};

/**
 * Predictable business error for the auth module. Always carries both
 * a stable code and a safe-for-users message; never leaks internal
 * information (e.g. whether an email exists).
 */
export class AuthException extends HttpException {
  constructor(code: AuthErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
