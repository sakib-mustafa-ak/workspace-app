import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/**
 * Domain event stream for the Authentication context.
 *
 * Why an internal Node `EventEmitter` rather than Nest's
 * `@nestjs/event-emitter` or a Redis pub/sub right now?
 *  - Every downstream handler in Phase 1 lives in the same process,
 *    so an in-process emitter is sufficient.
 *  - Keeping the transport in one file means Phase 2 can swap to
 *    Redis / Nest event-emitter without touching services that
 *    publish or subscribe — the Open/Closed Principle wins (Part III-B).
 *  - Loud DI integration: `AuthEventBus` is a regular injectable.
 *
 * Naming convention follows Part III-B "Domain Events":
 *   past-tense verbs (`UserRegistered`, `RefreshTokenRotated`).
 *
 * Each event handler runs synchronously inside the emitter loop; long-
 * running work belongs in a queue (Phase 9) and must not be invoked
 * synchronously here.
 */

export type UserRegisteredPayload = { userId: string };
export type UserLoggedInPayload = { userId: string; identityId: string };
export type UserLoggedOutPayload = { userId: string; sessionId: string };
export type RefreshTokenRotatedPayload = { userId: string; sessionId: string };

/**
 * Dispatched when a user requests a verification email, *after* the
 * message has been handed to the mail provider. Failures of the
 * provider itself are NOT published — they bubble through the
 * service's normal error envelope so callers can react.
 */
export type EmailVerificationRequestedPayload = {
  userId: string;
  email: string;
};

/**
 * Dispatched once the verifier matches and `users.email_verified_at`
 * has been written. Downstream notifications, audit, etc. subscribe
 * here (Part V-A "Authentication Events").
 */
export type EmailVerifiedPayload = { userId: string; email: string };

/**
 * Dispatched when a user requests a password-reset email *after* the
 * token row has been written and the mail handed off.
 *
 * Per blueprint: "Forgot Password → Email Token". Requesting never
 * reveals whether an account exists.
 */
export type PasswordResetRequestedPayload = {
  userId: string;
  email: string;
};

/**
 * Dispatched when the verifier matches and the password story has
 * been finalized: new hash committed, sessions revoked.
 *
 * Per blueprint: "Invalidate Existing Sessions" happens before this
 * event, so audit + analytics can correlate the "session family was
 * signed out" trail that follows.
 */
export type PasswordChangedPayload = {
  userId: string;
  revokedSessionIds: readonly string[];
};

export const AUTH_EVENTS = {
  userRegistered: 'UserRegistered',
  userLoggedIn: 'UserLoggedIn',
  userLoggedOut: 'UserLoggedOut',
  refreshTokenRotated: 'RefreshTokenRotated',
  emailVerificationRequested: 'EmailVerificationRequested',
  emailVerified: 'EmailVerified',
  passwordResetRequested: 'PasswordResetRequested',
  passwordChanged: 'PasswordChanged',
} as const;

export type AuthEventName =
  (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];

@Injectable()
export class AuthEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // EventEmitter throws on >10 listeners by default — far more than
    // any realistic Phase-1 hand-off needs. Lift the cap explicitly so
    // a runaway handler registration is loud but does not crash the app.
    this.emitter.setMaxListeners(50);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Publishers — invoked by AuthService during business workflows.
  // ─────────────────────────────────────────────────────────────────────

  publishUserRegistered(userId: string): void {
    this.emit(AUTH_EVENTS.userRegistered, { userId } satisfies UserRegisteredPayload);
  }

  publishUserLoggedIn(userId: string, identityId: string): void {
    this.emit(AUTH_EVENTS.userLoggedIn, {
      userId,
      identityId,
    } satisfies UserLoggedInPayload);
  }

  publishUserLoggedOut(userId: string, sessionId: string): void {
    this.emit(AUTH_EVENTS.userLoggedOut, {
      userId,
      sessionId,
    } satisfies UserLoggedOutPayload);
  }

  publishRefreshTokenRotated(userId: string, sessionId: string): void {
    this.emit(AUTH_EVENTS.refreshTokenRotated, {
      userId,
      sessionId,
    } satisfies RefreshTokenRotatedPayload);
  }

  publishEmailVerificationRequested(userId: string, email: string): void {
    this.emit(AUTH_EVENTS.emailVerificationRequested, {
      userId,
      email,
    } satisfies EmailVerificationRequestedPayload);
  }

  publishEmailVerified(userId: string, email: string): void {
    this.emit(AUTH_EVENTS.emailVerified, {
      userId,
      email,
    } satisfies EmailVerifiedPayload);
  }

  publishPasswordResetRequested(userId: string, email: string): void {
    this.emit(AUTH_EVENTS.passwordResetRequested, {
      userId,
      email,
    } satisfies PasswordResetRequestedPayload);
  }

  publishPasswordChanged(
    userId: string,
    revokedSessionIds: readonly string[],
  ): void {
    this.emit(AUTH_EVENTS.passwordChanged, {
      userId,
      revokedSessionIds,
    } satisfies PasswordChangedPayload);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Subscribers — typed so future handlers (audit, analytics, mail)
  // compile against the same payload shape publishers emit.
  // ─────────────────────────────────────────────────────────────────────

  onUserRegistered(
    listener: (payload: UserRegisteredPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.userRegistered, listener);
  }

  onUserLoggedIn(
    listener: (payload: UserLoggedInPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.userLoggedIn, listener);
  }

  onUserLoggedOut(
    listener: (payload: UserLoggedOutPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.userLoggedOut, listener);
  }

  onRefreshTokenRotated(
    listener: (payload: RefreshTokenRotatedPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.refreshTokenRotated, listener);
  }

  onEmailVerificationRequested(
    listener: (payload: EmailVerificationRequestedPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.emailVerificationRequested, listener);
  }

  onEmailVerified(
    listener: (payload: EmailVerifiedPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.emailVerified, listener);
  }

  onPasswordResetRequested(
    listener: (payload: PasswordResetRequestedPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.passwordResetRequested, listener);
  }

  onPasswordChanged(
    listener: (payload: PasswordChangedPayload) => void,
  ): void {
    this.emitter.on(AUTH_EVENTS.passwordChanged, listener);
  }

  private emit(name: AuthEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
