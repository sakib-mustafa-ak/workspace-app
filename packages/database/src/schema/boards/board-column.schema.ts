import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  DELETED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import { timestamp } from 'drizzle-orm/pg-core';
import { columnStatusEnum } from '../enums/board.enums.js';
import { boards } from './board.schema.js';

import {
  boardColumnAlias,
  boardColumnsTableName,
  COLUMN_NAME_MAX_LENGTH,
  COLUMN_NAME_MIN_LENGTH,
} from './board.constants.js';

export const boardColumns = pgTable(
  boardColumnsTableName,
  {
    id: PRIMARY_ID(),

    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    position: integer('position').notNull().default(0),

    status: columnStatusEnum('status').notNull().default('ACTIVE'),

    archivedAt: timestamp('archived_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    columnsBoardIdx: index('columns_board_idx').on(table.boardId),
    columnsBoardPositionUnique: unique('columns_board_position_unique').on(
      table.boardId,
      table.position,
    ),
    columnsNameBounds: check(
      'columns_name_bounds',
      sql`char_length(${table.name}) BETWEEN ${sql.raw(String(COLUMN_NAME_MIN_LENGTH))} AND ${sql.raw(String(COLUMN_NAME_MAX_LENGTH))}`,
    ),
    columnsArchivedAtConsistency: check(
      'columns_archived_at_consistency',
      sql`(${table.archivedAt} IS NULL) OR (${table.status} = 'ARCHIVED')`,
    ),
  }),
);

export type BoardColumnRow = typeof boardColumns.$inferSelect;
export type NewBoardColumnRow = typeof boardColumns.$inferInsert;

export const boardColumnAccess = {
  table: boardColumns,
  alias: boardColumnAlias,
};
