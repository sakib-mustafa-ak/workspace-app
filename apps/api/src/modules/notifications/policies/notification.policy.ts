import { Inject, Injectable } from '@nestjs/common';

import { NotificationsRepository } from '../repositories/notifications.repository';

@Injectable()
export class NotificationPolicy {
  constructor(
    @Inject(NotificationsRepository)
    private readonly notificationsRepo: NotificationsRepository,
  ) {}

  public async canRead(
    notificationId: string,
    userId: string,
  ): Promise<boolean> {
    const notification = await this.notificationsRepo.findById(
      notificationId,
      userId,
    );
    return !!notification;
  }

  public async canArchive(
    notificationId: string,
    userId: string,
  ): Promise<boolean> {
    return this.canRead(notificationId, userId);
  }
}
