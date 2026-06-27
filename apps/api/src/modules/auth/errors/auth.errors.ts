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
  // ── Email verification (Part V-A) ────────────────────────────────
  INVALID_VERIFICATION_TOKEN: 'AUTH.INVALID_VERIFICATION_TOKEN',
  VERIFICATION_TOKEN_EXPIRED: 'AUTH.VERIFICATION_TOKEN_EXPIRED',
  VERIFICATION_TOKEN_CONSUMED: 'AUTH.VERIFICATION_TOKEN_CONSUMED',
  EMAIL_ALREADY_VERIFIED: 'AUTH.EMAIL_ALREADY_VERIFIED',
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
  // Verification errors are 400-class — the token simply doesn't match.
  // 401 would imply "must be authenticated", which is wrong for a public
  // endpoint. 410 for already-consumed, following conventional thinking:
  // the resource is gone. The endpoint stays 400 for malformed input
  // and 410 plus 422 for the consumption/already-verified edges.
  [AuthErrorCode.INVALID_VERIFICATION_TOKEN]: 400,
  [AuthErrorCode.VERIFICATION_TOKEN_EXPIRED]: 410,
  [AuthErrorCode.VERIFICATION_TOKEN_CONSUMED]: 410,
  [AuthErrorCode.EMAIL_ALREADY_VERIFIED]: 409,
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
