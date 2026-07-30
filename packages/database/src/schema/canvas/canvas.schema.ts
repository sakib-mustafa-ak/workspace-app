import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  DELETED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import {
  canvasObjectStatusEnum,
  canvasObjectTypeEnum,
} from '../enums/canvas.enums.js';
import { boards } from '../boards/board.schema.js';
import { workspaces } from '../workspaces/workspace.schema.js';
import { users } from '../users/user.schema.js';

import {
  CANVAS_NAME_MAX_LENGTH,
  CANVAS_OBJECT_DATA_MAX_LENGTH,
  canvasAlias,
  canvasObjectAlias,
  canvasObjectsTableName,
  canvasTableName,
} from './canvas.constants.js';

export const canvas = pgTable(
  canvasTableName,
  {
    id: PRIMARY_ID(),

    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),

    name: text('name').notNull().default('Canvas'),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    canvasBoardIdx: index('canvas_board_idx').on(table.boardId),
    canvasWorkspaceIdx: index('canvas_workspace_idx').on(table.workspaceId),
  }),
);

export const canvasObjects = pgTable(
  canvasObjectsTableName,
  {
    id: PRIMARY_ID(),

    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvas.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),

    type: canvasObjectTypeEnum('type').notNull(),
    status: canvasObjectStatusEnum('status').notNull().default('ACTIVE'),

    x: real('x').notNull().default(0),
    y: real('y').notNull().default(0),
    width: real('width').notNull().default(100),
    height: real('height').notNull().default(100),
    rotation: real('rotation').notNull().default(0),
    zIndex: integer('z_index').notNull().default(0),

    fill: text('fill'),
    stroke: text('stroke'),
    strokeWidth: real('stroke_width').notNull().default(1),
    opacity: real('opacity').notNull().default(1),

    data: jsonb('data'),

    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    archivedAt: timestamp('archived_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    objectsCanvasIdx: index('objects_canvas_idx').on(table.canvasId),
    objectsParentIdx: index('objects_parent_idx').on(table.parentId),
    objectsTypeIdx: index('objects_type_idx').on(table.type),
    objectsZIndexIdx: index('objects_z_index_idx').on(table.zIndex),
    objectsDataBounds: check(
      'objects_data_bounds',
      sql`char_length(${table.data}::text) <= ${sql.raw(String(CANVAS_OBJECT_DATA_MAX_LENGTH))}`,
    ),
    objectsArchivedAtConsistency: check(
      'objects_archived_at_consistency',
      sql`(${table.archivedAt} IS NULL) OR (${table.status} = 'ARCHIVED')`,
    ),
  }),
);

export type CanvasRow = typeof canvas.$inferSelect;
export type NewCanvasRow = typeof canvas.$inferInsert;
export type CanvasObjectRow = typeof canvasObjects.$inferSelect;
export type NewCanvasObjectRow = typeof canvasObjects.$inferInsert;

export const canvasAccess = {
  table: canvas,
  alias: canvasAlias,
};

export const canvasObjectAccess = {
  table: canvasObjects,
  alias: canvasObjectAlias,
};
