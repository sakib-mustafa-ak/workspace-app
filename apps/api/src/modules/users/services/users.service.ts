import { Inject, Injectable, Logger } from '@nestjs/common';

import { DATABASE, type Db, type UserRow } from '@repo/database';

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
    if (userId === targetUserId) {
      throw new UsersException(
        UsersErrorCode.CANNOT_DELETE_SELF,
        'Cannot delete your own account through this endpoint. Use account deletion flow.',
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

  public async listUsers(
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ users: UserRow[]; total: number }> {
    const [users, total] = await Promise.all([
      this.users.list(opts),
      this.users.count(),
    ]);
    return { users, total };
  }
}
