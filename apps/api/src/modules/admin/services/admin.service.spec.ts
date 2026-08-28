import { Test, TestingModule } from '@nestjs/testing';
import { AuthErrorCode, AuthException } from '../../auth/errors/auth.errors';
import { TokenService } from '../../auth/services/token.service';
import { AdminAuditRepository } from '../data/admin-audit.repository';
import { AdminRepository } from '../data/admin.repository';
import { AdminService } from './admin.service';

async function expectForbidden(promise: Promise<unknown>): Promise<void> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AuthException);
  expect((err as AuthException).getResponse()).toMatchObject({
    code: AuthErrorCode.FORBIDDEN,
  });
}

describe('AdminService', () => {
  let service: AdminService;
  let adminRepo: {
    findUserById: jest.Mock;
    lookupUsers: jest.Mock;
    lookupWorkspaces: jest.Mock;
    findWorkspaceById: jest.Mock;
  };
  let auditRepo: { record: jest.Mock };
  let tokens: { signAccessToken: jest.Mock };

  beforeEach(async () => {
    adminRepo = {
      findUserById: jest.fn(),
      lookupUsers: jest.fn(),
      lookupWorkspaces: jest.fn(),
      findWorkspaceById: jest.fn(),
    };
    auditRepo = { record: jest.fn().mockResolvedValue(undefined) };
    tokens = { signAccessToken: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: adminRepo },
        { provide: AdminAuditRepository, useValue: auditRepo },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  it('rejects impersonating yourself', async () => {
    await expectForbidden(service.impersonate('u-1', 'u-1'));
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('rejects impersonating another admin', async () => {
    adminRepo.findUserById.mockResolvedValue({
      id: 'u-2',
      isAdmin: true,
      status: 'ACTIVE',
    });
    await expectForbidden(service.impersonate('u-1', 'u-2'));
  });

  it('rejects impersonating a non-active user', async () => {
    adminRepo.findUserById.mockResolvedValue({
      id: 'u-2',
      isAdmin: false,
      status: 'SUSPENDED',
    });
    await expectForbidden(service.impersonate('u-1', 'u-2'));
  });

  it('audits the impersonation before issuing the token', async () => {
    adminRepo.findUserById.mockResolvedValue({
      id: 'u-2',
      email: 'u@x.io',
      displayName: 'U',
      status: 'ACTIVE',
      isAdmin: false,
    });
    tokens.signAccessToken.mockResolvedValue({
      token: 'tkn',
      expiresInSeconds: 3600,
    });

    const res = await service.impersonate('u-1', 'u-2');

    expect(auditRepo.record).toHaveBeenCalledWith(
      'u-1',
      'user.impersonated',
      'user',
      'u-2',
      { impersonatorId: 'u-1' },
    );
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      sub: 'u-2',
      role: 'USER',
      impersonatorId: 'u-1',
    });
    expect(res.token).toBe('tkn');
  });
});
