import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  DELETED_AT,
  PRIMARY_ID,
  tsvector,
  UPDATED_AT,
} from '../common.js';
import { timestamp } from 'drizzle-orm/pg-core';
import { boardStatusEnum } from '../enums/board.enums.js';
import { workspaces } from '../workspaces/workspace.schema.js';

import {
  boardAlias,
  BOARD_NAME_MAX_LENGTH,
  BOARD_NAME_MIN_LENGTH,
  boardsTableName,
} from './board.constants.js';

export const boards = pgTable(
  boardsTableName,
  {
    id: PRIMARY_ID(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),

    name: text('name').notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('english', name || ' ' || COALESCE(description, ''))`,
    ),

    status: boardStatusEnum('status').notNull().default('ACTIVE'),

    archivedAt: timestamp('archived_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    boardsWorkspaceIdx: index('boards_workspace_idx').on(table.workspaceId),
    boardsWorkspacePositionUnique: uniqueIndex('boards_workspace_position_unique')
      .on(table.workspaceId, table.position)
      .where(sql`deleted_at IS NULL`),
    boardsNameBounds: check(
      'boards_name_bounds',
      sql`char_length(${table.name}) BETWEEN ${sql.raw(String(BOARD_NAME_MIN_LENGTH))} AND ${sql.raw(String(BOARD_NAME_MAX_LENGTH))}`,
    ),
    boardsArchivedAtConsistency: check(
      'boards_archived_at_consistency',
      sql`(${table.archivedAt} IS NULL) OR (${table.status} = 'ARCHIVED')`,
    ),
    boardsSearchVectorIdx: index('boards_search_vector_idx').using(
      'gin',
      table.searchVector,
    ),
  }),
);

export type BoardRow = typeof boards.$inferSelect;
export type NewBoardRow = typeof boards.$inferInsert;

export const boardAccess = {
  table: boards,
  alias: boardAlias,
};
