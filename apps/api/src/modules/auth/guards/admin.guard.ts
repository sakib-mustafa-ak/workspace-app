import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthErrorCode, AuthException } from '../errors/auth.errors';
import type { CurrentUser } from '../interfaces/current-user.interface';

/**
 * Platform-admin gate. `request.user` is repopulated from the database
 * on every request by `JwtAuthGuard`, so `isAdmin` here reflects current
 * DB state — never just the token's `role` claim.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: CurrentUser;
    }>();
    const user = request.user;
    if (!user?.isAdmin) {
      throw new AuthException(AuthErrorCode.FORBIDDEN, 'Admin access only.');
    }
    return true;
  }
}
