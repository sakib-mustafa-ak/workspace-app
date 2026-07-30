import { HttpException } from '@nestjs/common';

export const ChecklistErrorCode = {
  ITEM_NOT_FOUND: 'CHECKLIST.ITEM_NOT_FOUND',
  NOT_A_MEMBER: 'CHECKLIST.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'CHECKLIST.INSUFFICIENT_ROLE',
} as const;

export type ChecklistErrorCode =
  (typeof ChecklistErrorCode)[keyof typeof ChecklistErrorCode];

const STATUS_BY_CODE: Readonly<Record<ChecklistErrorCode, number>> = {
  [ChecklistErrorCode.ITEM_NOT_FOUND]: 404,
  [ChecklistErrorCode.NOT_A_MEMBER]: 403,
  [ChecklistErrorCode.INSUFFICIENT_ROLE]: 403,
};

export class ChecklistException extends HttpException {
  constructor(code: ChecklistErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
