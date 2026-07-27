import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  DELETED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import {
  taskPriorityEnum,
  taskStatusEnum,
} from '../enums/task.enums.js';
import { boardColumns } from '../boards/board-column.schema.js';
import { boards } from '../boards/board.schema.js';
import { workspaces } from '../workspaces/workspace.schema.js';
import { users } from '../users/user.schema.js';

import {
  taskAlias,
  TASK_TITLE_MAX_LENGTH,
  tasksTableName,
} from './task.constants.js';

export const tasks = pgTable(
  tasksTableName,
  {
    id: PRIMARY_ID(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    columnId: uuid('column_id')
      .notNull()
      .references(() => boardColumns.id, { onDelete: 'restrict' }),

    title: text('title').notNull(),
    description: text('description'),

    position: integer('position').notNull().default(0),

    status: taskStatusEnum('status').notNull().default('TODO'),
    priority: taskPriorityEnum('priority').notNull().default('NONE'),

    assigneeId: uuid('assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    dueDate: timestamp('due_date', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    tasksWorkspaceIdx: index('tasks_workspace_idx').on(table.workspaceId),
    tasksBoardIdx: index('tasks_board_idx').on(table.boardId),
    tasksColumnIdx: index('tasks_column_idx').on(table.columnId),
    tasksAssigneeIdx: index('tasks_assignee_idx').on(table.assigneeId),
    tasksStatusIdx: index('tasks_status_idx').on(table.status),
    tasksTitleBounds: check(
      'tasks_title_bounds',
      sql`char_length(${table.title}) <= ${sql.raw(String(TASK_TITLE_MAX_LENGTH))}`,
    ),
    tasksCompletedAtConsistency: check(
      'tasks_completed_at_consistency',
      sql`(${table.completedAt} IS NULL) OR (${table.status} = 'DONE')`,
    ),
  }),
);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;

export const taskAccess = {
  table: tasks,
  alias: taskAlias,
};
