import { pgEnum } from 'drizzle-orm/pg-core';

export const notificationTypeEnum = pgEnum('notification_type', [
  'COMMENT_ADDED',
  'BOARD_SHARED',
  'WORKSPACE_UPDATED',
  'MENTION_CREATED',
  'MEMBER_ADDED',
  'INVITATION_ACCEPTED',
  'TASK_ASSIGNED',
  'FILE_UPLOADED',
]);

export type NotificationType =
  (typeof notificationTypeEnum.enumValues)[number];

export const notificationChannelEnum = pgEnum('notification_channel', [
  'IN_APP',
  'EMAIL',
]);

export type NotificationChannel =
  (typeof notificationChannelEnum.enumValues)[number];

export const notificationStatusEnum = pgEnum('notification_status', [
  'CREATED',
  'QUEUED',
  'DELIVERED',
  'READ',
  'ARCHIVED',
]);

export type NotificationStatus =
  (typeof notificationStatusEnum.enumValues)[number];
