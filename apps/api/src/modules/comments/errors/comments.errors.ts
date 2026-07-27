import { HttpException } from '@nestjs/common';

export const CommentsErrorCode = {
  COMMENT_NOT_FOUND: 'COMMENT.NOT_FOUND',
  NOT_A_MEMBER: 'COMMENT.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'COMMENT.INSUFFICIENT_ROLE',
  BOARD_NOT_FOUND: 'COMMENT.BOARD_NOT_FOUND',
  CANNOT_EDIT: 'COMMENT.CANNOT_EDIT',
  CANNOT_DELETE: 'COMMENT.CANNOT_DELETE',
} as const;

export type CommentsErrorCode =
  (typeof CommentsErrorCode)[keyof typeof CommentsErrorCode];

const STATUS_BY_CODE: Readonly<Record<CommentsErrorCode, number>> = {
  [CommentsErrorCode.COMMENT_NOT_FOUND]: 404,
  [CommentsErrorCode.NOT_A_MEMBER]: 403,
  [CommentsErrorCode.INSUFFICIENT_ROLE]: 403,
  [CommentsErrorCode.BOARD_NOT_FOUND]: 404,
  [CommentsErrorCode.CANNOT_EDIT]: 403,
  [CommentsErrorCode.CANNOT_DELETE]: 403,
};

export class CommentsException extends HttpException {
  constructor(code: CommentsErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
