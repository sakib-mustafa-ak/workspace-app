import { HttpException } from '@nestjs/common';

export const NotificationsErrorCode = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION.NOT_FOUND',
  NOTIFICATION_ARCHIVED: 'NOTIFICATION.ARCHIVED',
} as const;

export type NotificationsErrorCode =
  (typeof NotificationsErrorCode)[keyof typeof NotificationsErrorCode];

const STATUS_BY_CODE: Readonly<Record<NotificationsErrorCode, number>> = {
  [NotificationsErrorCode.NOTIFICATION_NOT_FOUND]: 404,
  [NotificationsErrorCode.NOTIFICATION_ARCHIVED]: 410,
};

export class NotificationsException extends HttpException {
  constructor(code: NotificationsErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
