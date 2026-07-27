import { HttpException } from '@nestjs/common';

export const BoardsErrorCode = {
  BOARD_NOT_FOUND: 'BOARD.NOT_FOUND',
  BOARD_ARCHIVED: 'BOARD.ARCHIVED',
  COLUMN_NOT_FOUND: 'BOARD.COLUMN_NOT_FOUND',
  COLUMN_ARCHIVED: 'BOARD.COLUMN_ARCHIVED',
  NOT_A_MEMBER: 'BOARD.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'BOARD.INSUFFICIENT_ROLE',
} as const;

export type BoardsErrorCode =
  (typeof BoardsErrorCode)[keyof typeof BoardsErrorCode];

const STATUS_BY_CODE: Readonly<Record<BoardsErrorCode, number>> = {
  [BoardsErrorCode.BOARD_NOT_FOUND]: 404,
  [BoardsErrorCode.BOARD_ARCHIVED]: 423,
  [BoardsErrorCode.COLUMN_NOT_FOUND]: 404,
  [BoardsErrorCode.COLUMN_ARCHIVED]: 423,
  [BoardsErrorCode.NOT_A_MEMBER]: 403,
  [BoardsErrorCode.INSUFFICIENT_ROLE]: 403,
};

export class BoardsException extends HttpException {
  constructor(code: BoardsErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
