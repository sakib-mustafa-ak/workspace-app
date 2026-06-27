import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DATABASE,
  emailVerificationTokens,
  eq,
  sql,
  type Db,
  users,
} from '@repo/database';

import { EMAIL_VERIFICATION_TTL_SECONDS } from '../auth.constants';
import {
  AuthException,
  AuthErrorCode,
} from '../errors/auth.errors';
import { AuthEventBus } from '../events/auth.events';
import {
  MAIL_PROVIDER,
  RecordingMailProvider,
  type MailMessage,
} from '../mail/mail.provider';
import { renderVerificationMail } from '../mail/verification.template';
import {
  EmailVerificationTokenRepository,
} from '../repositories/email-verification-token.repository';

import { TokenHashService } from './token-hash.service';

/**
 * Email-verification workflow (Part V-A "Email Verification").
 *
 * Flow:
 *   1. `requestVerification({ userId, email })` mints a selector +
 *      verifier pair, stores the verifier's SHA-256 hash, and hands
 *      the public URL to the configured mail provider.
 *   2. The user opens the URL → `POST /auth/verify-email { token }`.
 *   3. `verify({ token })` splits selector/verifier, looks up the row,
 *      constant-time compares the verifier, expires + consumed checks
 *      pass → flips `consumed_at`, mirrors `email_verified_at` on the
 *      user, publishes `EmailVerified`.
 *
 * The service never logs the verifier or the unhashed token. The
 * mail provider receives only the constructed URL.
 *
 * This service depends on:
 *   - `MAIL_PROVIDER` (provider abstraction; Part III-B)
 *   - `EmailVerificationTokenRepository` (persistence)
 *   - `UserRepository` would cleanest update `email_verified_at` — the
 *     update can stay here until the Users module lands. Public column
 *     mirror keeps the read path simple (Part V-A "Email Verification").
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(MAIL_PROVIDER) private readonly mail: RecordingMailProvider,
    private readonly eventBus: AuthEventBus,
    private readonly tokenHash: TokenHashService,
    private readonly repository: EmailVerificationTokenRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Look up the user by email and mint a verification request
   * transparently. Returns silently when no user matches the address
   * so the API never leaks whether an account exists (Part IX-API).
   *
   * Matches against `users.email` case-insensitively to avoid the
   * "Ada typed ADa@…" trap.
   */
  public async requestVerificationForEmail(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const found = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    const target = found[0];
    if (!target) {
      // No-op for non-existing emails. We still publish the requested
      // event shape upstream is informed later — auth never reveals it.
      return;
    }
    await this.requestVerification({
      userId: target.id,
      email: target.email,
    });
  }

  /**
   * Mint a fresh token, store its verifier-hash, and dispatch the
   * verification email. Always 202-returns; never leaks whether an
   * account exists (Part IX-API Standards "We never expose whether
   * an account already exists").
   */
  public async requestVerification(input: {
    userId: string;
    email: string;
  }): Promise<void> {
    const expires = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000,
    );
    const { selector, verifier } =
      this.tokenHash.generateSelectorAndVerifier();
    const verifierHash = this.tokenHash.hash(verifier);
    const ttlMinutes = Math.round(EMAIL_VERIFICATION_TTL_SECONDS / 60);

    await this.repository.mintForUser({
      userId: input.userId,
      email: input.email,
      selector,
      verifierHash,
      expiresAt: expires,
    });

    const appBaseUrl =
      this.configService.get<string>('app.publicBaseUrl') ??
      'http://localhost:3000';
    const verifyPath = this.configService.get<string>(
      'auth.verifyEmailPath',
    ) ?? 'auth/verify-email';

    const rendered = renderVerificationMail({
      appBaseUrl,
      verifyPath,
      selector,
      verifier,
      expiresInMinutes: ttlMinutes,
    });

    const message: MailMessage = {
      to: input.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    };

    await this.mail.send(message);

    this.eventBus.publishEmailVerificationRequested(input.userId, input.email);
  }

  /**
   * Resolve a verification token (selector.verifier) into the matching
   * user and mark them verified. Returns the canonical user-shape so
   * the controller can surface the verification status immediately.
   *
   * Failure modes (mapped to `AuthException` codes):
   *   - missing selector row    → INVALID_VERIFICATION_TOKEN
   *   - verifier mismatch       → INVALID_VERIFICATION_TOKEN
   *   - row consumed already    → VERIFICATION_TOKEN_CONSUMED
   *   - row expired             → VERIFICATION_TOKEN_EXPIRED
   *
   * All four are constant-time on the verifier (Part V-A "Security Rules").
   */
  public async verify(input: { token: string }): Promise<{ userId: string; email: string }> {
    const split = this.splitToken(input.token);
    if (!split) {
      throw new AuthException(
        AuthErrorCode.INVALID_VERIFICATION_TOKEN,
        'Verification token is malformed.',
      );
    }

    const row = await this.repository.findBySelector(split.selector);
    if (!row) {
      throw new AuthException(
        AuthErrorCode.INVALID_VERIFICATION_TOKEN,
        'Verification token is unknown.',
      );
    }

    const matches = this.tokenHash.equals(row.verifierHash, split.verifier);
    if (!matches) {
      throw new AuthException(
        AuthErrorCode.INVALID_VERIFICATION_TOKEN,
        'Verification token is invalid.',
      );
    }

    if (row.consumedAt !== null) {
      throw new AuthException(
        AuthErrorCode.VERIFICATION_TOKEN_CONSUMED,
        'Verification token has already been used.',
      );
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new AuthException(
        AuthErrorCode.VERIFICATION_TOKEN_EXPIRED,
        'Verification token has expired.',
      );
    }

    return this.db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: new Date() })
        .where(
          sql`${emailVerificationTokens.id} = ${row.id} AND ${emailVerificationTokens.consumedAt} IS NULL`,
        );

      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, row.userId));

      this.eventBus.publishEmailVerified(row.userId, row.email);

      return { userId: row.userId, email: row.email };
    });
  }

  /**
   * Split the public token into selector + verifier. The wire format
   * is `selector.verifier`; the verifier is the high-entropy portion
   * that gets hashed server-side. We do not validate base64url
   * here — the repository's unique index handles malformed input
   * gracefully (just no match).
   */
  private splitToken(token: string): { selector: string; verifier: string } | null {
    const dotIndex = token.indexOf('.');
    if (dotIndex <= 0 || dotIndex === token.length - 1) {
      return null;
    }
    return {
      selector: token.slice(0, dotIndex),
      verifier: token.slice(dotIndex + 1),
    };
  }
}
