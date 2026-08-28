import { Inject, Injectable } from '@nestjs/common';

import { notificationTypeEnum, type NotificationType } from '@repo/database';

import { NotificationPreferencesRepository } from '../repositories/notification-preferences.repository';

const ALL_TYPES = notificationTypeEnum.enumValues;

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject(NotificationPreferencesRepository)
    private readonly repo: NotificationPreferencesRepository,
  ) {}

  public async getAll(userId: string): Promise<
    Array<{
      type: NotificationType;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>
  > {
    const rows = await this.repo.listByUser(userId);
    const byType = new Map(rows.map((r) => [r.type, r]));
    return ALL_TYPES.map((type) => {
      const row = byType.get(type);
      return {
        type,
        emailEnabled: row ? row.emailEnabled : true,
        inAppEnabled: row ? row.inAppEnabled : true,
      };
    });
  }

  public async upsert(
    userId: string,
    entries: Array<{
      type: NotificationType;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<void> {
    const known = new Set<string>(ALL_TYPES);
    const valid = entries.filter((e) => known.has(e.type));
    await this.repo.upsert(userId, valid);
  }

  public async isEmailEnabled(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const row = await this.repo.findByUserAndType(userId, type);
    return row ? row.emailEnabled : true;
  }
}
