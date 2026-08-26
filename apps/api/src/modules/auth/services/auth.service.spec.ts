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
  let sessions: jest.Mocked<SessionRepository>;
  let events: jest.Mocked<AuthEventBus>;

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
            findById: jest.fn(),
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
            publishRefreshTokenReused: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    sessions = module.get(SessionRepository);
    events = module.get(AuthEventBus);
  });

  describe('refresh token reuse detection', () => {
    const liveSession = {
      id: 's1',
      userId: 'u1',
      refreshTokenHash: 'different-hash',
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      deviceName: null,
      userAgent: null,
      ipAddress: null,
      publicKeys: null,
    };

    it('revokes the session and signals compromise when a superseded token is replayed', async () => {
      // Regression: replaying a rotated-out token used to throw a generic
      // INVALID_REFRESH_TOKEN with no revocation — an attacker holding a
      // stolen old token could keep probing indefinitely.
      sessions.findByRefreshTokenHash.mockResolvedValue(undefined);
      sessions.findById.mockResolvedValue(liveSession);

      await expect(
        service.refresh({
          refreshToken: 'stolen-superseded-token',
          meta: { ip: null, userAgent: null },
        }),
      ).rejects.toThrow('Refresh token is unknown.');

      expect(sessions.revoke).toHaveBeenCalledWith('s1');
      expect(events.publishRefreshTokenReused).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', sessionId: 's1' }),
      );
    });

    it('does not revoke when no live session matches the sid', async () => {
      sessions.findByRefreshTokenHash.mockResolvedValue(undefined);
      sessions.findById.mockResolvedValue(undefined);

      await expect(
        service.refresh({
          refreshToken: 'forged-token',
          meta: { ip: null, userAgent: null },
        }),
      ).rejects.toThrow('Refresh token is unknown.');

      expect(sessions.revoke).not.toHaveBeenCalled();
      expect(events.publishRefreshTokenReused).not.toHaveBeenCalled();
    });

    it('signals reuse when a revoked session token is presented again', async () => {
      sessions.findByRefreshTokenHash.mockResolvedValue({
        ...liveSession,
        revokedAt: new Date(),
      });

      await expect(
        service.refresh({
          refreshToken: 'current-but-revoked-token',
          meta: { ip: null, userAgent: null },
        }),
      ).rejects.toThrow('Refresh token has been revoked.');

      expect(events.publishRefreshTokenReused).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', sessionId: 's1' }),
      );
    });
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

  describe('register atomicity', () => {
    it('creates the user and identity inside one transaction', async () => {
      // Regression: register used to await users.create then
      // identities.createEmailIdentity on independent connections — an
      // identity failure left an orphaned user row that could not log in
      // or re-register. Both writes must now run on the SAME tx handle.
      const txHandle = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 's-tx' }]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
      };
      const db = {
        transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(txHandle),
          ),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DATABASE, useValue: db },
          {
            provide: UserRepository,
            useValue: {
              findByEmailWithPassword: jest.fn().mockResolvedValue(undefined),
              create: jest.fn().mockResolvedValue(mockUser),
            },
          },
          {
            provide: IdentityRepository,
            useValue: {
              createEmailIdentity: jest.fn().mockResolvedValue(mockIdentity),
            },
          },
          { provide: SessionRepository, useValue: {} },
          {
            provide: PasswordService,
            useValue: { hash: jest.fn().mockResolvedValue('argon2$hash') },
          },
          {
            provide: TokenService,
            useValue: {
              signAccessToken: jest
                .fn()
                .mockResolvedValue({ token: 'a', expiresInSeconds: 900 }),
              signRefreshToken: jest
                .fn()
                .mockResolvedValue({ token: 'r', expiresInSeconds: 30 }),
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
            },
          },
        ],
      }).compile();

      const registerService = module.get<AuthService>(AuthService);

      await registerService.register({
        displayName: 'Test',
        email: 'new@test.com',
        password: 'long-enough-password',
        meta: { ip: null, userAgent: null },
      });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      // The tx handle is forwarded so both writes share its fate.
      expect(module.get(UserRepository).create).toHaveBeenCalledWith(
        {
          displayName: 'Test',
          email: 'new@test.com',
          passwordHash: 'argon2$hash',
        },
        txHandle,
      );
      expect(
        module.get(IdentityRepository).createEmailIdentity,
      ).toHaveBeenCalledWith('u1', 'test@test.com', 'argon2$hash', txHandle);
    });

    it('does not publish UserRegistered when the transaction fails', async () => {
      const db = {
        transaction: jest
          .fn()
          .mockRejectedValue(new Error('identity insert failed')),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DATABASE, useValue: db },
          {
            provide: UserRepository,
            useValue: {
              findByEmailWithPassword: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: IdentityRepository,
            useValue: {},
          },
          { provide: SessionRepository, useValue: {} },
          {
            provide: PasswordService,
            useValue: { hash: jest.fn().mockResolvedValue('argon2$hash') },
          },
          {
            provide: TokenService,
            useValue: {
              signAccessToken: jest.fn(),
              signRefreshToken: jest.fn(),
            },
          },
          {
            provide: TokenHashService,
            useValue: { hash: jest.fn().mockReturnValue('hashed') },
          },
          {
            provide: AuthEventBus,
            useValue: { publishUserRegistered: jest.fn() },
          },
        ],
      }).compile();

      const failingService = module.get<AuthService>(AuthService);
      const events = module.get<AuthEventBus>(AuthEventBus);

      await expect(
        failingService.register({
          displayName: 'Test',
          email: 'boom@test.com',
          password: 'long-enough-password',
          meta: { ip: null, userAgent: null },
        }),
      ).rejects.toThrow('identity insert failed');
      expect(events.publishUserRegistered).not.toHaveBeenCalled();
    });
  });
});
