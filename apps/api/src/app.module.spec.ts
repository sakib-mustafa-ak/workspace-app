import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AppModule } from './app.module';
import { WorkspaceMembershipGuard } from './common/guards/workspace-membership.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';

interface GuardProvider {
  provide: unknown;
  useClass: unknown;
}

function globalGuards(moduleClass: unknown): GuardProvider[] {
  const providers = Reflect.getMetadata('providers', moduleClass) as
    | unknown[]
    | undefined;
  return (providers ?? []).filter(
    (p: unknown): p is GuardProvider =>
      typeof p === 'object' &&
      p !== null &&
      (p as GuardProvider).provide === APP_GUARD,
  );
}

describe('global guard ordering', () => {
  const appGuards = globalGuards(AppModule);

  it('mounts JwtAuthGuard before WorkspaceMembershipGuard in AppModule', () => {
    // NestJS runs root-module APP_GUARDs before imported-module guards,
    // in providers-array order. JwtAuthGuard MUST populate request.user
    // before WorkspaceMembershipGuard reads it, or every
    // @WorkspaceAccess route 401s with "Authentication required.".
    const order = appGuards.map((g) => g.useClass);
    const jwtIndex = order.indexOf(JwtAuthGuard);
    const membershipIndex = order.indexOf(WorkspaceMembershipGuard);
    expect(jwtIndex).not.toBe(-1);
    expect(membershipIndex).not.toBe(-1);
    expect(jwtIndex).toBeLessThan(membershipIndex);
    // Throttling runs last in the chain.
    expect(order.indexOf(ThrottlerGuard)).toBeGreaterThan(membershipIndex);
  });

  it('does not register JwtAuthGuard as APP_GUARD from AuthModule', () => {
    const authGuards = globalGuards(AuthModule);
    expect(authGuards.some((g) => g.useClass === JwtAuthGuard)).toBe(false);
  });
});
