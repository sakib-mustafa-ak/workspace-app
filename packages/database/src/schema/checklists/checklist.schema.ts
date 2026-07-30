import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { CREATED_AT, PRIMARY_ID, UPDATED_AT } from '../common.js';
import { tasks } from '../tasks/task.schema.js';
import { checklistAlias, checklistItemsTableName } from './checklist.constants.js';

export const checklistItems = pgTable(
  checklistItemsTableName,
  {
    id: PRIMARY_ID(),
    taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    completed: boolean('completed').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    checklistTaskIdx: index('checklist_task_idx').on(table.taskId),
  }),
);

export type ChecklistItemRow = typeof checklistItems.$inferSelect;
export type NewChecklistItemRow = typeof checklistItems.$inferInsert;

export const checklistAccess = {
  table: checklistItems,
  alias: checklistAlias,
};
