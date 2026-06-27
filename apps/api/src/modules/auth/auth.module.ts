import { Module } from '@nestjs/common';

import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  MAIL_PROVIDER,
  RecordingMailProvider,
} from './mail/mail.provider';
import {
  EmailVerificationTokenRepository,
} from './repositories/email-verification-token.repository';
import { IdentityRepository } from './repositories/identity.repository';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';
import { AuthService } from './services/auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { TokenHashService } from './services/token-hash.service';
import { TokenService } from './services/token.service';
import { AuthEventBus } from './events/auth.events';

/**
 * Authentication bounded-context module.
 *
 * Composition (per Part V-A "Authentication Responsibilities"):
 *
 *   Controllers        → AuthController            — wire shape only
 *   Services           → AuthService + helpers
 *                        + EmailVerificationService
 *   Repositories       → User / Identity / Session
 *                        + EmailVerificationToken
 *   Provider           → RecordingMailProvider     — Phase 1 mail sink
 *   Cross-cutting      → JwtAuthGuard + AuthEventBus
 *
 * The module deliberately does NOT register a `JwtAuthGuard` globally.
 * `AppModule` mounts that as `APP_GUARD` so opting out is `@Public()`.
 *
 * Exports:
 *   - `AuthService` — call sites in *other* modules consume only this.
 *   - `JwtAuthGuard` — keeps the guard instance inside the module so
 *     controllers in other contexts can `@UseGuards(JwtAuthGuard)` if
 *     a single endpoint ever opts in differently. App-level global
 *     is what `AppModule` does today.
 *   - `AuthEventBus` — `Notifications`, `Audit`, `Analytics` subscribe
 *     here in later phases. Keep the export now so adding subscribers
 *     later is wiring-only.
 *
 * Imports:
 *   - `ConfigModule` is global (AppModule) so we do not re-import it.
 *   - `DatabaseModule` is global (AppModule) — repositories resolve
 *     via the `DATABASE` token with `@Inject(DATABASE)`.
 */
@Module({
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,
    EmailVerificationService,
    PasswordService,
    TokenHashService,
    TokenService,
    // Repositories
    UserRepository,
    IdentityRepository,
    SessionRepository,
    EmailVerificationTokenRepository,
    // Mail provider — abstract (MAIL_PROVIDER), concrete (Recorder)
    RecordingMailProvider,
    {
      provide: MAIL_PROVIDER,
      useExisting: RecordingMailProvider,
    },
    // Cross-cutting
    AuthEventBus,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard, AuthEventBus],
})
export class AuthModule {}
