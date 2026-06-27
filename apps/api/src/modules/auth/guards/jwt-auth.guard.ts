import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthException, AuthErrorCode } from '../errors/auth.errors';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../services/token.service';
import { UserRepository } from '../repositories/user.repository';
import type { CurrentUser } from '../interfaces/current-user.interface';

const BEARER_RE = /^Bearer\s+(.+)$/;

/**
 * Bearer-token guard.
 *
 * Behavior:
 *  - Endpoints marked `@Public()` are skipped entirely.
 *  - Other endpoints REQUIRE `Authorization: Bearer <token>` and that
 *    the token must verify against the configured ACCESS secret.
 *  - On success: populate `request.user` so controllers can read it.
 *  - On failure: throw an `AuthException` with a stable code so the
 *    global filter translates it cleanly.
 *
 * Why a guard rather than middleware? Because decorators are the unit
 * of opt-out: `Public()` rides alongside endpoints. Middleware runs
 * per-route-group and would leak per-handler state we don't want.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    const header = request.headers['authorization'] ?? '';
    const match = BEARER_RE.exec(header);
    if (!match) {
      throw new AuthException(
        AuthErrorCode.UNAUTHENTICATED,
        'Authentication required.',
      );
    }

    let payload = { sub: '' };
    try {
      // TokenService.verifyAccessToken returns AccessTokenPayload,
      // which guarantees a string `sub`. The cast keeps older
      // refactors safe without changing the asserted invariant.
      const verified = await this.tokenService.verifyAccessToken(
        match[1]!,
      );
      payload = { sub: verified.sub };
    } catch (err) {
      // Verification failures are auth issues, never engineering bugs.
      this.logger.warn(
        { reason: (err as Error).message },
        'Access token verification failed',
      );
      throw new AuthException(
        AuthErrorCode.UNAUTHENTICATED,
        'Invalid or expired token.',
      );
    }

    const user = await this.userRepository.findByIdWithPassword(payload.sub);
    if (!user || user.deletedAt !== null) {
      throw new AuthException(
        AuthErrorCode.UNAUTHENTICATED,
        'Authenticated user no longer exists.',
      );
    }

    const current: CurrentUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
    };

    (request as unknown as { user: CurrentUser }).user = current;

    return true;
  }
}
