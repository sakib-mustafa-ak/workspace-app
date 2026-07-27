import { pgEnum } from 'drizzle-orm/pg-core';

export const taskStatusEnum = pgEnum('task_status', [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
]);

export type TaskStatus =
  (typeof taskStatusEnum.enumValues)[number];

export const taskPriorityEnum = pgEnum('task_priority', [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export type TaskPriority =
  (typeof taskPriorityEnum.enumValues)[number];
