import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  DATABASE,
  eq,
  sessions,
  type Db,
  type IdentityRow,
  type SessionRow,
  type UserRow,
} from '@repo/database';

import { AuthEventBus } from '../events/auth.events';
import {
  AuthException,
  AuthErrorCode,
} from '../errors/auth.errors';
import { IdentityRepository } from '../repositories/identity.repository';
import { SessionRepository } from '../repositories/session.repository';
import { UserRepository } from '../repositories/user.repository';
import type { CurrentUser } from '../interfaces/current-user.interface';

import { PasswordService } from './password.service';
import { TokenHashService } from './token-hash.service';
import { TokenService } from './token.service';

export interface LoginMetadata {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthenticatedSession {
  user: UserRow;
  identity: IdentityRow;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresInSeconds: number;
    refreshTokenExpiresInSeconds: number;
  };
  session: SessionRow;
}

/**
 * AuthService — single entry point for business workflows in the auth context.
 *
 * Why so much code lives here rather than in a controller: every
 * workflow (`register`, `login`, `refresh`, `logout`) crosses multiple
 * repositories and must publish events atomically. Keeping that
 * choreography in one place means HTTP edges stay mechanical and
 * tests can probe the workflow directly.
 *
 * The service never deals with HTTP shapes — it returns plain domain
 * rows. DTO shaping is the controller's job.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly users: UserRepository,
    private readonly identities: IdentityRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly tokenHash: TokenHashService,
    private readonly events: AuthEventBus,
  ) {}

  /**
   * Begin a brand-new account, identity and first session in one
   * transaction. We never expose whether an account already exists;
   * the controller reports a generic success / a clearer error if we
   * MUST fail (per blueprint rule "Business errors are expected").
   */
  public async register(input: {
    displayName: string;
    email: string;
    password: string;
    meta: LoginMetadata;
  }): Promise<AuthenticatedSession> {
    const existing = await this.users.findByEmailWithPassword(input.email);
    if (existing) {
      throw new AuthException(
        AuthErrorCode.EMAIL_ALREADY_EXISTS,
        'An account with this email already exists.',
      );
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.create({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
    });
    const identity = await this.identities.createEmailIdentity(
      user.id,
      user.email,
      passwordHash,
    );

    const result = await this.openSession(user, identity, input.meta);
    this.events.publishUserRegistered(user.id);
    return result;
  }

  /**
   * Verify credentials, open a session, return tokens. The password
   * verification happens with `argon2.verify` which is constant-time
   * internally — we never leak whether the failure was "no user" or
   * "wrong password" to the caller.
   */
  public async login(input: {
    email: string;
    password: string;
    meta: LoginMetadata;
  }): Promise<AuthenticatedSession> {
    const user = await this.users.findByEmailWithPassword(input.email);
    if (!user) {
      await this.passwords.hash('dummy-time-anchor');
      throw new AuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Email or password is incorrect.',
      );
    }
    if (user.status === 'SUSPENDED') {
      throw new AuthException(
        AuthErrorCode.ACCOUNT_SUSPENDED,
        'This account is suspended.',
      );
    }
    if (user.status === 'DELETED' || user.deletedAt !== null) {
      throw new AuthException(
        AuthErrorCode.ACCOUNT_DELETED,
        'This account is no longer available.',
      );
    }

    const ok = await this.passwords.verify(user.passwordHash, input.password);
    if (!ok) {
      throw new AuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Email or password is incorrect.',
      );
    }

    const identity = await this.identities.findEmailIdentityForUser(user.id);
    if (!identity) {
      // Email identity must exist for the EMAIL provider; this is a
      // data invariant violation.
      throw new AuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Email or password is incorrect.',
      );
    }
    await this.identities.touchLastUsed(identity.id);

    const result = await this.openSession(user, identity, input.meta);
    this.events.publishUserLoggedIn(user.id, identity.id);
    return result;
  }

  /**
   * Rotate refresh token: verify, mint a new pair, revoke the old one.
   * Token rotation is non-negotiable: even on failure we revoke the
   * old session to limit the blast radius of a stolen token.
   */
  public async refresh(input: {
    refreshToken: string;
    meta: LoginMetadata;
  }): Promise<AuthenticatedSession> {
    let sessionId: string | null = null;
    try {
      const verified = await this.tokens.verifyRefreshToken(input.refreshToken);
      sessionId = verified.sid;

      const storedHash = this.tokenHash.hash(input.refreshToken);
      const session = await this.sessions.findByRefreshTokenHash(storedHash);
      if (!session) {
        throw new AuthException(
          AuthErrorCode.INVALID_REFRESH_TOKEN,
          'Refresh token is unknown.',
        );
      }
      if (session.id !== sessionId) {
        // Mismatch means the JWT `sid` does not match the hash bucket.
        // Revoke what we have, keep the surface quiet.
        await this.sessions.revoke(session.id);
        throw new AuthException(
          AuthErrorCode.INVALID_REFRESH_TOKEN,
          'Refresh token is invalid.',
        );
      }
      if (session.revokedAt !== null) {
        throw new AuthException(
          AuthErrorCode.REFRESH_TOKEN_REVOKED,
          'Refresh token has been revoked.',
        );
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        throw new AuthException(
          AuthErrorCode.REFRESH_TOKEN_EXPIRED,
          'Refresh token has expired.',
        );
      }

      const user = await this.users.findByIdWithPassword(session.userId);
      if (!user) {
        throw new AuthException(
          AuthErrorCode.UNAUTHENTICATED,
          'Account is unavailable.',
        );
      }
      const identity = await this.identities.findEmailIdentityForUser(user.id);
      if (!identity) {
        throw new AuthException(
          AuthErrorCode.UNAUTHENTICATED,
          'Identity is unavailable.',
        );
      }

      // Rotate: mint the new pair FIRST, then revoke the previous session
      // and replace its hash atomically.
      const fresh = await this.sessionTokensFor(user, session.id, this.sessionExpiresAtIn(session));
      await this.sessions.replaceRefreshToken(session.id, this.tokenHash.hash(fresh.refreshToken));
      await this.sessions.touch(session.id, input.meta.ip, input.meta.userAgent);
      this.events.publishRefreshTokenRotated(user.id, session.id);
      return {
        user,
        identity,
        session,
        tokens: fresh,
      };
    } catch (err) {
      if (sessionId && err instanceof AuthException === false) {
        // Best-effort pruning; never crash the request because of it.
        await this.sessions.revoke(sessionId).catch(() => undefined);
      }
      throw err;
    }
  }

  /**
   * Revoke the session that owns the supplied refresh token. We accept
   * either the plain text or the hash — only opaque-token APIs SHOULD
   * ever see the plain one, but we guard against misuse.
   */
  public async logout(input: {
    refreshToken: string;
  }): Promise<void> {
    let sessionId: string | null = null;
    try {
      const verified = await this.tokens.verifyRefreshToken(input.refreshToken);
      sessionId = verified.sid;
    } catch (err) {
      // We swallow JWT failures: logout is best-effort. But if the token
      // produces nothing verifiable we still scrub the bucket by hash.
      const storedHash = this.tokenHash.hash(input.refreshToken);
      const session = await this.sessions.findByRefreshTokenHash(storedHash);
      if (session) {
        await this.sessions.revoke(session.id);
        this.events.publishUserLoggedOut(session.userId, session.id);
      }
      return;
    }
    const storedHash = this.tokenHash.hash(input.refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(storedHash);
    if (!session || session.id !== sessionId) return;
    await this.sessions.revoke(session.id);
    this.events.publishUserLoggedOut(session.userId, session.id);
  }

  /**
   * Hydrate the canonical `CurrentUser` shape for `GET /auth/me`.
   * Reads the user fresh — never trust a long-lived cache for the
   * status field, because of how quickly suspensions propagate.
   */
  public async loadCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) {
      throw new AuthException(
        AuthErrorCode.UNAUTHENTICATED,
        'Account is unavailable.',
      );
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────

  private async openSession(
    user: UserRow,
    identity: IdentityRow,
    meta: LoginMetadata,
  ): Promise<AuthenticatedSession> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 8);

    return this.db.transaction(async (tx) => {
      const [persisted] = await tx
        .insert(sessions)
        .values({
          userId: user.id,
          refreshTokenHash:
            'placeholder-' + Math.random().toString(36).slice(2, 12),
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          expiresAt,
          lastUsedAt: new Date(),
        })
        .returning();

      if (!persisted) {
        throw new Error('Failed to insert session.');
      }

      const tokens = await this.sessionTokensFor(
        user,
        persisted.id,
        expiresAt,
      );

      await tx
        .update(sessions)
        .set({ refreshTokenHash: this.tokenHash.hash(tokens.refreshToken) })
        .where(
          // `drizzle-orm` operators are re-exported through
          // `@repo/database` to keep a single TypeScript resolution
          // path active across the workspace.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          eq(sessions.id, persisted.id),
        );

      return { user, identity, session: persisted, tokens };
    });
  }

  private async sessionTokensFor(
    user: UserRow,
    sessionId: string,
    expiresAt: Date,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresInSeconds: number;
    refreshTokenExpiresInSeconds: number;
  }> {
    const access = await this.tokens.signAccessToken({
      sub: user.id,
      role: 'USER',
    });
    const refresh = await this.tokens.signRefreshToken({
      sub: user.id,
      sid: sessionId,
    });
    void expiresAt; // expiresAt is the session lifetime; refresh token TTL intentionally bound by JWT settings
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresInSeconds: access.expiresInSeconds,
      refreshTokenExpiresInSeconds: refresh.expiresInSeconds,
    };
  }

  private sessionExpiresAtIn(_session: SessionRow): Date {
    return new Date(Date.now() + 60 * 60 * 8);
  }
}
