import { HttpException } from '@nestjs/common';

export const CanvasErrorCode = {
  CANVAS_NOT_FOUND: 'CANVAS.NOT_FOUND',
  OBJECT_NOT_FOUND: 'CANVAS.OBJECT_NOT_FOUND',
  BOARD_NOT_FOUND: 'CANVAS.BOARD_NOT_FOUND',
  NOT_A_MEMBER: 'CANVAS.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'CANVAS.INSUFFICIENT_ROLE',
  CANNOT_EDIT: 'CANVAS.CANNOT_EDIT',
  CANNOT_DELETE: 'CANVAS.CANNOT_DELETE',
} as const;

export type CanvasErrorCode =
  (typeof CanvasErrorCode)[keyof typeof CanvasErrorCode];

const STATUS_BY_CODE: Readonly<Record<CanvasErrorCode, number>> = {
  [CanvasErrorCode.CANVAS_NOT_FOUND]: 404,
  [CanvasErrorCode.OBJECT_NOT_FOUND]: 404,
  [CanvasErrorCode.BOARD_NOT_FOUND]: 404,
  [CanvasErrorCode.NOT_A_MEMBER]: 403,
  [CanvasErrorCode.INSUFFICIENT_ROLE]: 403,
  [CanvasErrorCode.CANNOT_EDIT]: 403,
  [CanvasErrorCode.CANNOT_DELETE]: 403,
};

export class CanvasException extends HttpException {
  constructor(code: CanvasErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
