import { Inject, Injectable } from '@nestjs/common';

import { AdminAuditLogRow } from '@repo/database';

import { AuthErrorCode, AuthException } from '../../auth/errors/auth.errors';
import { TokenService } from '../../auth/services/token.service';

import { AdminAuditRepository } from '../data/admin-audit.repository';
import { AdminRepository } from '../data/admin.repository';
import type { AdminAuditFilters } from '../data/admin-audit.repository';

@Injectable()
export class AdminService {
  constructor(
    @Inject(AdminRepository) private readonly adminRepo: AdminRepository,
    @Inject(AdminAuditRepository)
    private readonly adminAuditRepo: AdminAuditRepository,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  static readonly STUB_SUBSCRIPTION = {
    plan: 'free',
    status: 'active',
    note: 'stubbed — billed in Phase 3',
  } as const;

  public async impersonate(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Cannot impersonate yourself.',
      );
    }

    const target = await this.adminRepo.findUserById(targetId);
    if (!target) {
      throw new AuthException(
        AuthErrorCode.UNAUTHENTICATED,
        'Target user not found.',
      );
    }
    if (target.isAdmin) {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Cannot impersonate another admin.',
      );
    }
    if (target.status !== 'ACTIVE') {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Cannot impersonate an inactive account.',
      );
    }

    await this.adminAuditRepo.record(
      actorId,
      'user.impersonated',
      'user',
      targetId,
      { impersonatorId: actorId },
    );

    const token = await this.tokens.signAccessToken({
      sub: target.id,
      role: target.isAdmin ? 'ADMIN' : 'USER',
      impersonatorId: actorId,
    });

    return {
      token: token.token,
      expiresInSeconds: token.expiresInSeconds,
      user: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        status: target.status,
        isAdmin: target.isAdmin,
      },
    };
  }

  public async listAudit(
    filters: AdminAuditFilters = {},
  ): Promise<AdminAuditLogRow[]> {
    return this.adminAuditRepo.list(filters);
  }
}
