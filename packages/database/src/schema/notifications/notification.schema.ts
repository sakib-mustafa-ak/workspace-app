import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import {
  notificationChannelEnum,
  notificationStatusEnum,
  notificationTypeEnum,
} from '../enums/notification.enums.js';
import { users } from '../users/user.schema.js';

import { notificationAlias, notificationsTableName } from './notification.constants.js';

export const notifications = pgTable(
  notificationsTableName,
  {
    id: PRIMARY_ID(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: notificationTypeEnum('type').notNull(),
    channel: notificationChannelEnum('channel').notNull().default('IN_APP'),
    status: notificationStatusEnum('status').notNull().default('CREATED'),

    title: text('title').notNull(),
    body: text('body'),

    resourceType: text('resource_type'),
    resourceId: text('resource_id'),

    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', {
      withTimezone: true,
      mode: 'date',
    }),
    archivedAt: timestamp('archived_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    notificationsUserIdx: index('notifications_user_idx').on(table.userId),
    notificationsUserStatusIdx: index('notifications_user_status_idx').on(
      table.userId,
      table.status,
    ),
    notificationsTypeIdx: index('notifications_type_idx').on(table.type),
  }),
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;

export const notificationAccess = {
  table: notifications,
  alias: notificationAlias,
};
