import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { CREATED_AT, DELETED_AT, PRIMARY_ID, UPDATED_AT } from '../common.js';
import { users } from '../users/user.schema.js';

export const personalEvents = pgTable('personal_events', {
  id: PRIMARY_ID(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
  location: text('location'),
  notes: text('notes'),
  createdAt: CREATED_AT(),
  updatedAt: UPDATED_AT(),
  deletedAt: DELETED_AT(),
}, (table) => ({
  userStartIdx: index('personal_events_user_start_idx').on(table.userId, table.startsAt),
  validDuration: check('personal_events_valid_duration', sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
}));
