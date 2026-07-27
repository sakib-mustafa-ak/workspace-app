import { HttpException } from '@nestjs/common';

export const TasksErrorCode = {
  TASK_NOT_FOUND: 'TASK.NOT_FOUND',
  TASK_ARCHIVED: 'TASK.ARCHIVED',
  COLUMN_NOT_FOUND: 'TASK.COLUMN_NOT_FOUND',
  NOT_A_MEMBER: 'TASK.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'TASK.INSUFFICIENT_ROLE',
  BOARD_ARCHIVED: 'TASK.BOARD_ARCHIVED',
} as const;

export type TasksErrorCode =
  (typeof TasksErrorCode)[keyof typeof TasksErrorCode];

const STATUS_BY_CODE: Readonly<Record<TasksErrorCode, number>> = {
  [TasksErrorCode.TASK_NOT_FOUND]: 404,
  [TasksErrorCode.TASK_ARCHIVED]: 423,
  [TasksErrorCode.COLUMN_NOT_FOUND]: 404,
  [TasksErrorCode.NOT_A_MEMBER]: 403,
  [TasksErrorCode.INSUFFICIENT_ROLE]: 403,
  [TasksErrorCode.BOARD_ARCHIVED]: 423,
};

export class TasksException extends HttpException {
  constructor(code: TasksErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
