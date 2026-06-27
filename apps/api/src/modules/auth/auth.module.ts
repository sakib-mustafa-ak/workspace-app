import { Module } from '@nestjs/common';

import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IdentityRepository } from './repositories/identity.repository';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenHashService } from './services/token-hash.service';
import { TokenService } from './services/token.service';
import { AuthEventBus } from './events/auth.events';

/**
 * Authentication bounded-context module.
 *
 * Composition (per Part V-A "Authentication Responsibilities"):
 *
 *   Controllers        → AuthController      — wire shape only
 *   Services           → AuthService + 3 helpers  — business workflows
 *   Repositories       → User / Identity / Session  — persistence
 *   Cross-cutting      → JwtAuthGuard + AuthEventBus — DI graph
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
    PasswordService,
    TokenHashService,
    TokenService,
    // Repositories
    UserRepository,
    IdentityRepository,
    SessionRepository,
    // Cross-cutting
    AuthEventBus,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard, AuthEventBus],
})
export class AuthModule {}
