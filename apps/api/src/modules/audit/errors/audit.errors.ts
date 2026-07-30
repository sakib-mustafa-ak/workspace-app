import { HttpException } from '@nestjs/common';

export const AuditErrorCode = {
  AUDIT_NOT_FOUND: 'AUDIT.NOT_FOUND',
} as const;

export type AuditErrorCode =
  (typeof AuditErrorCode)[keyof typeof AuditErrorCode];

const STATUS_BY_CODE: Readonly<Record<AuditErrorCode, number>> = {
  [AuditErrorCode.AUDIT_NOT_FOUND]: 404,
};

export class AuditException extends HttpException {
  constructor(code: AuditErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
