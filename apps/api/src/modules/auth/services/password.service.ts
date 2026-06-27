import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import { ARGON2_OPTIONS } from '../auth.constants';

/**
 * Argon2id password hashing (Part V-A — Password Strategy).
 *
 * Wrapping the third-party API in a thin service accomplishes several
 * things at once:
 *   - The rest of the codebase depends on a single, mockable interface.
 *   - Switching to a stronger algorithm (argon2id → argon2d → scrypt)
 *     later is a one-file change.
 *   - Lint rules forbid floating promises; the wrapper ingests them.
 */
@Injectable()
export class PasswordService {
  /**
   * Hash a plaintext password. Returns an encoded string of the form
   * `$argon2id$v=19$m=19456,t=2,p=1$...` that is self-describing so we
   * can verify even if the constants change later.
   */
  public async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  /**
   * Constant-time compare. We rely on `argon2.verify`'s internal constant
   * time behaviour; never roll our own.
   */
  public async verify(hash: string, plaintext: string): Promise<boolean> {
    if (!hash || !plaintext) return false;
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // Malformed stored hash changes nothing about caller's authority.
      return false;
    }
  }
}
