import { sql } from 'drizzle-orm';
import {
  check,
  index,
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
import { boards } from '../boards/board.schema.js';
import { workspaces } from '../workspaces/workspace.schema.js';
import { users } from '../users/user.schema.js';

import {
  boardCommentAlias,
  boardCommentsTableName,
  COMMENT_CONTENT_MIN_LENGTH,
} from './board-comment.constants.js';

export const boardComments = pgTable(
  boardCommentsTableName,
  {
    id: PRIMARY_ID(),

    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),

    parentId: uuid('parent_id'),

    content: text('content').notNull(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    editedAt: timestamp('edited_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
    deletedAt: DELETED_AT(),
  },
  (table) => ({
    commentsBoardIdx: index('comments_board_idx').on(table.boardId),
    commentsWorkspaceIdx: index('comments_workspace_idx').on(
      table.workspaceId,
    ),
    commentsParentIdx: index('comments_parent_idx').on(table.parentId),
    commentsUserIdx: index('comments_user_idx').on(table.userId),
    commentsContentBounds: check(
      'comments_content_bounds',
      sql`char_length(${table.content}) >= ${sql.raw(String(COMMENT_CONTENT_MIN_LENGTH))}`,
    ),
  }),
);

export type BoardCommentRow = typeof boardComments.$inferSelect;
export type NewBoardCommentRow = typeof boardComments.$inferInsert;

export const boardCommentAccess = {
  table: boardComments,
  alias: boardCommentAlias,
};
