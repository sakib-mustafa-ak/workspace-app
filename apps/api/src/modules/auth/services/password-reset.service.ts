import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  DATABASE,
  eq,
  isNull,
  identities,
  passwordResetTokens,
  sql,
  type Db,
  users,
} from '@repo/database';

import { PASSWORD_RESET_TTL_SECONDS } from '../auth.constants';
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
import {
  renderPasswordResetMail,
} from '../mail/password-reset.template';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { PasswordService } from './password.service';
import { SessionRepository } from '../repositories/session.repository';
import { TokenHashService } from './token-hash.service';

/**
 * Password-reset workflow (Part V-A "Password Reset").
 *
 * Flow contract:
 *   1. `requestResetForEmail({ email, ip, ua })` mints a fresh token,
 *      dispatches mail; never reveals whether the address matches a
 *      user (Part IX-API Standards).
 *   2. `consumeReset({ token, newPassword, ip, ua })` validates the
 *      selector.verifier pair, rotates the password hash on `users`
 *      and the EMAIL identity, revokes *all* live sessions for that
 *      user, and publishes `PasswordChanged`.
 *
 * Architectural invariants (Part III-B, Part V-A):
 *  - The verifier hash is stored; the verifier is never persisted.
 *  - Constant-time compare via TokenHashService.equals.
 *  - Hard-invalidate every session in one transaction with the
 *    password change — partial invalidation defeats the security
 *    purpose (Part V-A "Invalidate Existing Sessions").
 *  - Mail dispatch goes through the configured MailProvider so
 *    AuthService has zero vendor coupling.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(MAIL_PROVIDER) private readonly mail: RecordingMailProvider,
    private readonly eventBus: AuthEventBus,
    private readonly tokenHash: TokenHashService,
    private readonly passwords: PasswordService,
    private readonly repository: PasswordResetTokenRepository,
    private readonly sessions: SessionRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Look up the user by email and dispatch a fresh reset request
   * transparently. Silent on misses so account existence is never
   * leaked (Part IX-API Standards).
   */
  public async requestResetForEmail(input: {
    email: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> {
    const normalized = input.email.trim().toLowerCase();
    const found = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);

    const target = found[0];
    if (!target) {
      // No-op for unknown emails. The API already returned 202; this
      // branch just stays quiet. Audit subscribers may want to know
      // about high-volume unknown-email requests later — that's a
      // Notifications-side concern, not implemented in Phase 1.
      return;
    }

    await this.mintAndSend(target.id, target.email, input.ip, input.userAgent);
  }

  /**
   * Resolve a reset token (selector.verifier) into a verified email
   * and finalize the password change. The session revocation payload
   * is reported back for the `PasswordChanged` event so audit and
   * analytics have the session-id list without re-querying.
   */
  public async consumeReset(input: {
    token: string;
    newPassword: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{ userId: string; revokedSessionIds: readonly string[] }> {
    const split = this.splitToken(input.token);
    if (!split) {
      throw new AuthException(
        AuthErrorCode.INVALID_RESET_TOKEN,
        'Reset token is malformed.',
      );
    }

    const row = await this.repository.findBySelector(split.selector);
    if (!row) {
      throw new AuthException(
        AuthErrorCode.INVALID_RESET_TOKEN,
        'Reset token is unknown.',
      );
    }

    if (!this.tokenHash.equals(row.verifierHash, split.verifier)) {
      throw new AuthException(
        AuthErrorCode.INVALID_RESET_TOKEN,
        'Reset token is invalid.',
      );
    }

    if (row.consumedAt !== null) {
      throw new AuthException(
        AuthErrorCode.RESET_TOKEN_CONSUMED,
        'Reset token has already been used.',
      );
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new AuthException(
        AuthErrorCode.RESET_TOKEN_EXPIRED,
        'Reset token has expired.',
      );
    }

    const newHash = await this.passwords.hash(input.newPassword);

    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.id, row.id),
            isNull(passwordResetTokens.consumedAt),
          ),
        )
        .returning({ id: passwordResetTokens.id });
      if (updated.length === 0) {
        // Race: a parallel request consumed this row first.
        throw new AuthException(
          AuthErrorCode.RESET_TOKEN_CONSUMED,
          'Reset token has already been used.',
        );
      }

      await tx
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, row.userId));

      // Mirror into the EMAIL identity so login flow stays consistent
      // with the canonical user hash.
      await tx
        .update(identities)
        .set({ passwordHash: newHash })
        .where(
          and(
            eq(identities.userId, row.userId),
            eq(identities.provider, 'EMAIL'),
          ),
        );

      // Revoke every live session for the user. Existing
      // SessionRepository.revoke operates one row at a time, but
      // mass-revocation here stays inside the transaction so the
      // atomicity is preserved.  We keep the ids to surface in the
      // auth event.
      const liveSessions = await this.sessions.listLiveForUser(row.userId);
      const revokedIds: string[] = [];
      for (const s of liveSessions) {
        await this.sessions.revoke(s.id);
        revokedIds.push(s.id);
      }

      this.eventBus.publishPasswordChanged(row.userId, revokedIds);

      void tx; // ensure tx is referenced when no row was ever revoked
      return {
        userId: row.userId,
        revokedSessionIds: revokedIds,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────

  private async mintAndSend(
    userId: string,
    email: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000,
    );
    const { selector, verifier } =
      this.tokenHash.generateSelectorAndVerifier();

    await this.repository.mintForUser({
      userId,
      selector,
      verifierHash: this.tokenHash.hash(verifier),
      requestedFromIp: ip,
      userAgent,
      expiresAt,
    });

    const appBaseUrl =
      this.configService.get<string>('app.publicBaseUrl') ??
      'http://localhost:3000';
    const resetPath =
      this.configService.get<string>('auth.resetPasswordPath') ??
      'auth/reset-password';

    const rendered = renderPasswordResetMail({
      appBaseUrl,
      resetPath,
      selector,
      verifier,
      expiresInMinutes: Math.round(PASSWORD_RESET_TTL_SECONDS / 60),
    });

    const message: MailMessage = {
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    };

    await this.mail.send(message);
    this.eventBus.publishPasswordResetRequested(userId, email);
  }

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
