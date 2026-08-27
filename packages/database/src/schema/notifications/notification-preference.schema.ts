import { boolean, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { notificationTypeEnum } from '../enums/notification.enums.js';
import { users } from '../users/user.schema.js';
import {
  notificationPreferenceAlias,
  notificationPreferencesTableName,
} from './notification-preference.constants.js';

export const notificationPreferences = pgTable(
  notificationPreferencesTableName,
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.type] }),
  }),
);

export type NotificationPreferenceRow =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferenceRow =
  typeof notificationPreferences.$inferInsert;

export const notificationPreferenceAccess = {
  table: notificationPreferences,
  alias: notificationPreferenceAlias,
};