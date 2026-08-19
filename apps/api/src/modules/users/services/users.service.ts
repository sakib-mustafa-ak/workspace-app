import { Inject, Injectable, Logger } from '@nestjs/common';

import { DATABASE, type Db, type UserRow } from '@repo/database';

import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { UsersEventBus } from '../events/users.events';
import { UsersRepository } from '../repositories/users.repository';
import { UsersErrorCode, UsersException } from '../errors/users.errors';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(UsersEventBus) private readonly events: UsersEventBus,
    @Inject(WorkspaceMembersRepository)
    private readonly membersRepo: WorkspaceMembersRepository,
    @Inject(AuditRepository) private readonly auditRepo: AuditRepository,
  ) {}

  public async getProfile(userId: string): Promise<UserRow> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UsersException(
        UsersErrorCode.USER_NOT_FOUND,
        'User not found.',
      );
    }
    return user;
  }

  public async updateProfile(
    userId: string,
    input: {
      displayName?: string;
      avatarUrl?: string | null;
      bio?: string | null;
      timezone?: string | null;
      locale?: string | null;
    },
  ): Promise<UserRow> {
    const existing = await this.users.findById(userId);
    if (!existing) {
      throw new UsersException(
        UsersErrorCode.USER_NOT_FOUND,
        'User not found.',
      );
    }
    if (existing.status === 'SUSPENDED') {
      throw new UsersException(
        UsersErrorCode.ACCOUNT_SUSPENDED,
        'Account is suspended.',
      );
    }

    const updated = await this.users.updateProfile(userId, input);

    this.events.publishUserProfileUpdated({
      userId,
      ...input,
    });

    return updated;
  }

  public async deleteAccount(
    userId: string,
    targetUserId: string,
  ): Promise<void> {
    // Only self-deletion is allowed through this endpoint. Cross-user
    // deletion is a privilege-escalation hole (any authenticated user
    // could soft-delete any other account) and nothing in the product
    // legitimately needs an admin to delete a user yet. When an admin
    // flow is designed, add a real role check here.
    if (userId !== targetUserId) {
      throw new UsersException(
        UsersErrorCode.CANNOT_DELETE_OTHER,
        'You can only delete your own account.',
      );
    }

    const target = await this.users.findById(targetUserId);
    if (!target) {
      throw new UsersException(
        UsersErrorCode.USER_NOT_FOUND,
        'User not found.',
      );
    }

    await this.users.softDelete(targetUserId);
    this.events.publishUserAccountDeleted({ userId: targetUserId });
    this.logger.log(`Account deleted: user=${targetUserId} by=${userId}`);
  }

  private async assertVisible(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) return;
    const peers = await this.membersRepo.listPeerIds(requesterId);
    if (!peers.includes(id)) {
      throw new UsersException(
        UsersErrorCode.USER_NOT_FOUND,
        'User not found.',
      );
    }
  }

  public async getUserById(id: string, requesterId: string): Promise<UserRow> {
    await this.assertVisible(id, requesterId);
    return this.getProfile(id);
  }

  public async listUsers(
    opts: {
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: 'displayName' | 'email' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {},
    requesterId: string,
  ): Promise<{ users: UserRow[]; total: number }> {
    const ids = [
      requesterId,
      ...(await this.membersRepo.listPeerIds(requesterId)),
    ];
    const [rows, total] = await Promise.all([
      this.users.list({ ...opts, ids }),
      this.users.countFiltered(opts.search, ids),
    ]);
    return { users: rows, total };
  }

  /**
   * Workspace memberships for a user (public profile data — same shape the
   * workspace member list uses, with the workspace name resolved).
   */
  public async getUserMemberships(userId: string, requesterId: string) {
    await this.assertVisible(userId, requesterId);
    const memberships = await this.membersRepo.listByUserWithWorkspace(userId);
    return memberships.map((m) => ({
      workspaceId: m.workspaceId,
      workspaceName: m.workspaceName,
      role: m.role,
      joinedAt: m.joinedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Recent audit events authored by a user, newest first. Capped — the
   * user profile page renders a short timeline, not a full audit view.
   */
  public async getUserActivity(
    userId: string,
    requesterId: string,
    limit = 20,
  ) {
    await this.assertVisible(userId, requesterId);
    const rows = await this.auditRepo.listByUser(userId, limit);
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.resourceType,
      entityId: r.resourceId,
      metadata: r.metadata ?? {},
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
