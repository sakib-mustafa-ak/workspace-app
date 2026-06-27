/**
 * Auth module constants.
 *
 * What lives here?
 *   - Numeric/timing values used both in code and tests.
 *   - Anything that, if changed, must change in lockstep across the
 *     token service, session repository and tests.
 *
 * What does NOT live here?
 *   - Domain logic (lives in services/repositories).
 *   - Database column names (lives in `@repo/database/schema/auth`).
 */

/** argon2id — the blueprint-mandated default (Part V-A). */
export const PASSWORD_HASH_ALGO = 'argon2id' as const;

/**
 * Tuned for ~70–250ms on commodity servers per Office of the CTO guidance.
 * Bumped heavier than the argon2 defaults because Workspace OS targets
 * SaaS load (no client-side throttling).
 */
export const ARGON2_OPTIONS = {
  type: 2, // argon2id
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Exported so future admin tooling can tighten/relax this without a code chase. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export const SESSION_DEFAULT_TTL_SECONDS = 60 * 60 * 8; // 8h hard cap on a single refresh cycle
export const REFRESH_TOKEN_COOKIE = 'rt' as const;

export const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1h
export const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24; // 24h
