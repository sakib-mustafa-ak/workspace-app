/**
 * Public contract for the JWT payload.
 *
 * Everything inside `AccessTokenPayload` is a *claim*: a fact about the
 * caller that business logic may rely on. Anything that changes per
 * request (route, body, etc.) belongs in HTTP context, NOT the token.
 *
 * Stability:
 *  - `sub` (subject = userId) is the canonical identifier — required.
 *  - `role` is decorative for fast gating; authorization MUST still go
 *    through `WorkspacePolicies` for actual membership checks.
 *  - `iat`/`exp` are signed in by `jose` automatically.
 *  - Adding new fields is backward compatible (extra claims are ignored).
 *  - Renaming or removing a field is a major API change → new token
 *    version (e.g. `v2`) parsed next to `v1`.
 */
export const JWT_ACCESS_PAYLOAD_VERSION = 1 as const;

export interface AccessTokenPayload {
  /** Indicates which claim schema this token understands. */
  v: typeof JWT_ACCESS_PAYLOAD_VERSION;
  /** Subject — the user id. */
  sub: string;
  /** Optional display hint, never required for auth. */
  role?: 'USER' | 'ADMIN';
}

/**
 * Refresh-token claim shape. Refresh tokens are opaque to clients; we
 * still sign them so we can detect tampering before we even look at
 * the sessions table.
 */
export interface RefreshTokenPayload {
  v: typeof JWT_ACCESS_PAYLOAD_VERSION;
  sub: string;
  /** Stable id of the session row this token belongs to. */
  sid: string;
}
