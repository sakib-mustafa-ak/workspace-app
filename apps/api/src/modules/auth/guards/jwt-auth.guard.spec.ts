import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';
import { UserRepository } from '../repositories/user.repository';
import { TokenService } from '../services/token.service';

describe('verified-email access boundary', () => {
  function setup(
    verified: boolean,
    allowUnverified = false,
    authenticated = true,
  ) {
    const handler = () => {};
    if (allowUnverified)
      Reflect.defineMetadata(ALLOW_UNVERIFIED_KEY, true, handler);
    const request = {
      headers: { authorization: authenticated ? 'Bearer test-token' : '' },
    };
    const context = {
      getHandler: () => handler,
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new JwtAuthGuard(
      new Reflector(),
      {
        verifyAccessToken: jest.fn().mockResolvedValue({ sub: 'user' }),
      } as unknown as TokenService,
      {
        findByIdWithPassword: jest.fn().mockResolvedValue({
          id: 'user',
          status: 'ACTIVE',
          deletedAt: null,
          emailVerifiedAt: verified ? new Date() : null,
        }),
      } as unknown as UserRepository,
    );
    return { guard, context };
  }
  it('blocks unverified accounts with a 403, not a refresh-triggering 401', async () => {
    const { guard, context } = setup(false);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'AUTH.EMAIL_NOT_VERIFIED' },
      status: 403,
    });
  });
  it('allows verified users', async () => {
    const { guard, context } = setup(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
  it('allows unverified users to load their account status', async () => {
    const { guard, context } = setup(false, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
  it('never lets the unverified exception bypass authentication', async () => {
    const { guard, context } = setup(false, true, false);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
  });
});
