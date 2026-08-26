import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE, type UserRow, type IdentityRow } from '@repo/database';

import { SESSION_DEFAULT_TTL_SECONDS } from '../auth.constants';
import { AuthEventBus } from '../events/auth.events';
import { IdentityRepository } from '../repositories/identity.repository';
import { SessionRepository } from '../repositories/session.repository';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { TokenHashService } from './token-hash.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

const mockUser: UserRow = {
  id: 'u1',
  displayName: 'Test User',
  email: 'test@test.com',
  passwordHash: 'argon2$hash',
  status: 'ACTIVE',
  avatarUrl: null,
  bio: null,
  timezone: null,
  locale: null,
  emailVerifiedAt: new Date(),
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockIdentity: IdentityRow = {
  id: 'i1',
  userId: 'u1',
  provider: 'EMAIL',
  providerUserId: null,
  emailForOAuth: null,
  isPrimary: true,
  passwordHash: 'argon2$hash',
  lastUsedAt: null,
  createdAt: new Date(),
  deletedAt: null,
};

describe('AuthService session lifecycle', () => {
  let service: AuthService;

  const persistedSession = () => ({
    id: 's1',
    userId: 'u1',
    refreshTokenHash: 'placeholder',
    ipAddress: null,
    userAgent: null,
    expiresAt: new Date(0),
    lastUsedAt: new Date(),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const inserted: Record<string, unknown> = {};
    const tx = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockImplementation((v: Record<string, unknown>) => {
        Object.assign(inserted, v);
        return tx;
      }),
      returning: jest
        .fn()
        .mockImplementation(() => [{ ...persistedSession(), ...inserted }]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };
    const db = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: db },
        {
          provide: UserRepository,
          useValue: {
            findByEmailWithPassword: jest.fn().mockResolvedValue(mockUser),
            findByIdWithPassword: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: IdentityRepository,
          useValue: {
            findEmailIdentityForUser: jest.fn().mockResolvedValue(mockIdentity),
            touchLastUsed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SessionRepository,
          useValue: {
            findByRefreshTokenHash: jest.fn(),
            revoke: jest.fn(),
            replaceRefreshToken: jest.fn(),
            touch: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn().mockResolvedValue('argon2$hash'),
            verify: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: TokenService,
          useValue: {
            signAccessToken: jest
              .fn()
              .mockResolvedValue({ token: 'access', expiresInSeconds: 900 }),
            signRefreshToken: jest
              .fn()
              .mockResolvedValue({ token: 'refresh', expiresInSeconds: 30 }),
            verifyRefreshToken: jest.fn().mockResolvedValue({ sid: 's1' }),
          },
        },
        {
          provide: TokenHashService,
          useValue: { hash: jest.fn().mockReturnValue('hashed') },
        },
        {
          provide: AuthEventBus,
          useValue: {
            publishUserRegistered: jest.fn(),
            publishUserLoggedIn: jest.fn(),
            publishRefreshTokenRotated: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login opens a session with the configured TTL', () => {
    it('persists expiresAt ~SESSION_DEFAULT_TTL_SECONDS in the future (milliseconds, not seconds)', async () => {
      const startedAt = Date.now();

      const result = await service.login({
        email: 'test@test.com',
        password: 'correct-horse',
        meta: { ip: null, userAgent: null },
      });

      const expectedTtlMs = SESSION_DEFAULT_TTL_SECONDS * 1000;
      const actualTtlMs = result.session.expiresAt.getTime() - startedAt;

      // The regression this guards against: treating the second-based
      // constant as milliseconds yields a ~29-second session lifetime.
      expect(actualTtlMs).toBeGreaterThanOrEqual(expectedTtlMs - 1000);
      expect(actualTtlMs).toBeLessThanOrEqual(expectedTtlMs + 1000);
    });
  });
});
