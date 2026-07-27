import { pgEnum } from 'drizzle-orm/pg-core';

export const boardStatusEnum = pgEnum('board_status', [
  'ACTIVE',
  'ARCHIVED',
]);

export type BoardStatus =
  (typeof boardStatusEnum.enumValues)[number];

export const columnStatusEnum = pgEnum('column_status', [
  'ACTIVE',
  'ARCHIVED',
]);

export type ColumnStatus =
  (typeof columnStatusEnum.enumValues)[number];
