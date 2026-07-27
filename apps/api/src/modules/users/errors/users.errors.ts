import { HttpException } from '@nestjs/common';

export const UsersErrorCode = {
  USER_NOT_FOUND: 'USERS.NOT_FOUND',
  EMAIL_ALREADY_TAKEN: 'USERS.EMAIL_ALREADY_TAKEN',
  CANNOT_DELETE_SELF: 'USERS.CANNOT_DELETE_SELF',
  ACCOUNT_SUSPENDED: 'USERS.ACCOUNT_SUSPENDED',
} as const;

export type UsersErrorCode =
  (typeof UsersErrorCode)[keyof typeof UsersErrorCode];

const STATUS_BY_CODE: Readonly<Record<UsersErrorCode, number>> = {
  [UsersErrorCode.USER_NOT_FOUND]: 404,
  [UsersErrorCode.EMAIL_ALREADY_TAKEN]: 409,
  [UsersErrorCode.CANNOT_DELETE_SELF]: 422,
  [UsersErrorCode.ACCOUNT_SUSPENDED]: 403,
};

export class UsersException extends HttpException {
  constructor(code: UsersErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
