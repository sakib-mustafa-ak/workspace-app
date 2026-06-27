import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Refresh-token hashing + opaque-token generation.
 *
 * Two design choices that are worth highlighting:
 *
 *   1. The plain refresh token is a 32-byte URL-safe random string.
 *      That gives ~256 bits of secret entropy, more than enough for an
 *      attacker to be forced to compromise the DB instead.
 *   2. We never store the plain token. We store its SHA-256 hash and
 *      compare with `crypto.timingSafeEqual` so attackers can't probe
 *      hashed values byte-by-byte. The constant-time compare matters
 *      because hashes are case-sensitive: a naive `===` leaks byte
 *      differences in nanoseconds.
 *
 * The same building blocks are reused elsewhere in the auth module —
 * `generateSelectorAndVerifier` produces the canonical "selector :
 * verifier" pair for one-time-use links (email verification, password
 * reset, invitations).
 */
@Injectable()
export class TokenHashService {
  /** Generate a fresh opaque refresh-token value for one new session. */
  public generateRefreshToken(): { plain: string; hash: string } {
    const plain = randomBytes(32).toString('base64url');
    return { plain, hash: this.hash(plain) };
  }

  /**
   * Generate an independent selector + verifier pair for single-use
   * links (email verification, password reset, invitations).
   *
   * The two random pools are independent on purpose: even if a future
   * hashing algorithm becomes weak, a leaked verifier never reveals
   * the selector (and vice-versa).
   */
  public generateSelectorAndVerifier(): {
    selector: string;
    verifier: string;
  } {
    return {
      selector: randomBytes(16).toString('base64url'),
      verifier: randomBytes(32).toString('base64url'),
    };
  }

  /** Deterministic SHA-256 over the plaintext token. */
  public hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  /** Constant-time comparison. Tested for length-mismatch safety. */
  public equals(aHash: string, plainText: string): boolean {
    if (typeof aHash !== 'string' || typeof plainText !== 'string') return false;
    const candidate = Buffer.from(this.hash(plainText), 'hex');
    const stored = Buffer.from(aHash, 'hex');
    if (stored.length !== candidate.length) return false;
    return timingSafeEqual(stored, candidate);
  }
}
