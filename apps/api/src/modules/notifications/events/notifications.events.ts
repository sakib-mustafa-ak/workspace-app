import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type NotificationCreatedPayload = {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
};

export type NotificationDeliveredPayload = {
  notificationId: string;
  userId: string;
};

export const NOTIFICATIONS_EVENTS = {
  notificationCreated: 'NotificationCreated',
  notificationDelivered: 'NotificationDelivered',
} as const;

export type NotificationsEventName =
  (typeof NOTIFICATIONS_EVENTS)[keyof typeof NOTIFICATIONS_EVENTS];

@Injectable()
export class NotificationsEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishNotificationCreated(payload: NotificationCreatedPayload): void {
    this.emit(NOTIFICATIONS_EVENTS.notificationCreated, payload);
  }

  onNotificationCreated(
    listener: (payload: NotificationCreatedPayload) => void,
  ): void {
    this.emitter.on(NOTIFICATIONS_EVENTS.notificationCreated, listener);
  }

  publishNotificationDelivered(payload: NotificationDeliveredPayload): void {
    this.emit(NOTIFICATIONS_EVENTS.notificationDelivered, payload);
  }

  private emit(name: NotificationsEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
