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

export const AUTH_EVENTS = {
  userRegistered: 'UserRegistered',
  userLoggedIn: 'UserLoggedIn',
  userLoggedOut: 'UserLoggedOut',
  refreshTokenRotated: 'RefreshTokenRotated',
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

  private emit(name: AuthEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
