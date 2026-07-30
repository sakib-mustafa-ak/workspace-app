import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import {
  CREATED_AT,
  DELETED_AT,
  PRIMARY_ID,
  UPDATED_AT,
} from '../common.js';
import { boards } from '../boards/board.schema.js';
import { workspaces } from '../workspaces/workspace.schema.js';
import { users } from '../users/user.schema.js';

import { uploadAlias, uploadsTableName } from './upload.constants.js';

export const uploadedFiles = pgTable(
  uploadsTableName,
  {
    id: PRIMARY_ID(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    boardId: uuid('board_id').references(() => boards.id, {
      onDelete: 'set null',
    }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    provider: text('provider').notNull().default('local'),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    uploadsWorkspaceIdx: index('uploads_workspace_idx').on(table.workspaceId),
    uploadsBoardIdx: index('uploads_board_idx').on(table.boardId),
    uploadsUserIdx: index('uploads_user_idx').on(table.userId),
  }),
);

export type UploadedFileRow = typeof uploadedFiles.$inferSelect;
export type NewUploadedFileRow = typeof uploadedFiles.$inferInsert;

export const uploadAccess = {
  table: uploadedFiles,
  alias: uploadAlias,
};
