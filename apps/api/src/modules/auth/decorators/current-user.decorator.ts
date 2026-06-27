import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { CurrentUser as CurrentUserType } from '../interfaces/current-user.interface';

/**
 * Pulls the authenticated user that `JwtAuthGuard` deposited on the
 * request. Controllers receive a typed `CurrentUser` object directly.
 *
 * Throws nothing here: the guard has already enforced presence. Any
 * downstream business authorization is the caller's responsibility.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserType => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CurrentUserType }>();
    return request.user;
  },
);
