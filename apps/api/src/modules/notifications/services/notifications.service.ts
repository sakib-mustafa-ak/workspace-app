import { Inject, Injectable, Logger } from '@nestjs/common';

import type { NotificationRow, NotificationType } from '@repo/database';

import {
  NotificationsErrorCode,
  NotificationsException,
} from '../errors/notifications.errors';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsEventBus } from '../events/notifications.events';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NotificationsRepository)
    private readonly notificationsRepo: NotificationsRepository,
    @Inject(NotificationsEventBus)
    private readonly events: NotificationsEventBus,
  ) {}

  public async create(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      body?: string;
      resourceType?: string;
      resourceId?: string;
    },
  ): Promise<NotificationRow> {
    const notification = await this.notificationsRepo.create({
      userId,
      type: input.type,
      channel: 'IN_APP',
      status: 'CREATED',
      title: input.title,
      body: input.body ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
    });

    this.events.publishNotificationCreated({
      notificationId: notification.id,
      userId,
      type: input.type,
      title: notification.title,
      body: notification.body,
    });

    return notification;
  }

  public async createAndDeliver(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      body?: string;
      resourceType?: string;
      resourceId?: string;
    },
  ): Promise<NotificationRow> {
    const notification = await this.create(userId, input);

    await this.notificationsRepo.deliver(notification.id);

    return notification;
  }

  public async list(
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<NotificationRow[]> {
    return this.notificationsRepo.listByUser(userId, opts);
  }

  public async getById(
    notificationId: string,
    userId: string,
  ): Promise<NotificationRow> {
    const notification = await this.notificationsRepo.findById(
      notificationId,
      userId,
    );
    if (!notification) {
      throw new NotificationsException(
        NotificationsErrorCode.NOTIFICATION_NOT_FOUND,
        'Notification not found.',
      );
    }
    return notification;
  }

  public async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepo.countUnread(userId);
    return { count };
  }

  public async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationRow> {
    const notification = await this.notificationsRepo.findById(
      notificationId,
      userId,
    );
    if (!notification) {
      throw new NotificationsException(
        NotificationsErrorCode.NOTIFICATION_NOT_FOUND,
        'Notification not found.',
      );
    }
    if (notification.status === 'ARCHIVED') {
      throw new NotificationsException(
        NotificationsErrorCode.NOTIFICATION_ARCHIVED,
        'Notification is archived.',
      );
    }
    return this.notificationsRepo.markAsRead(notificationId, userId);
  }

  public async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepo.markAllAsRead(userId);
  }

  public async archive(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationsRepo.findById(
      notificationId,
      userId,
    );
    if (!notification) {
      throw new NotificationsException(
        NotificationsErrorCode.NOTIFICATION_NOT_FOUND,
        'Notification not found.',
      );
    }
    await this.notificationsRepo.archive(notificationId, userId);
  }
}
