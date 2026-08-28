import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type NotificationPreferenceRow,
  notificationPreferences,
  type NotificationType,
} from '@repo/database';

@Injectable()
export class NotificationPreferencesRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async listByUser(
    userId: string,
  ): Promise<NotificationPreferenceRow[]> {
    return this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
  }

  public async findByUserAndType(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreferenceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, type),
        ),
      )
      .limit(1);
    return row;
  }

  public async upsert(
    userId: string,
    entries: Array<{
      type: NotificationType;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.db
      .insert(notificationPreferences)
      .values(
        entries.map((e) => ({
          userId,
          type: e.type,
          emailEnabled: e.emailEnabled,
          inAppEnabled: e.inAppEnabled,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [notificationPreferences.userId, notificationPreferences.type],
        set: {
          emailEnabled: sql`excluded.email_enabled`,
          inAppEnabled: sql`excluded.in_app_enabled`,
          updatedAt: sql`now()`,
        },
      });
  }
}
