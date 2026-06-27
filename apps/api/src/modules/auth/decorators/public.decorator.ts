import { SetMetadata } from '@nestjs/common';

/**
 * Marker key indicating an endpoint does not require authentication.
 *
 * Defaults: every controller is protected by `JwtAuthGuard` once it's
 * installed at the AppModule level. Routes that want to opt out wrap
 * themselves with `@Public()`. This keeps the protected-by-default
 * invariant easy to enforce even if a developer forgets.
 */
export const IS_PUBLIC_KEY = 'auth:isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
