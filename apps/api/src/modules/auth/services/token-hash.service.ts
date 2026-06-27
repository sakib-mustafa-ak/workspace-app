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
 */
@Injectable()
export class TokenHashService {
  /** Generate a fresh opaque refresh-token value for one new session. */
  public generateRefreshToken(): { plain: string; hash: string } {
    const plain = randomBytes(32).toString('base64url');
    return { plain, hash: this.hash(plain) };
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
