import { HttpException } from '@nestjs/common';

export const UploadErrorCode = {
  UPLOAD_NOT_FOUND: 'UPLOAD.NOT_FOUND',
  BOARD_NOT_FOUND: 'UPLOAD.BOARD_NOT_FOUND',
  NOT_A_MEMBER: 'UPLOAD.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'UPLOAD.INSUFFICIENT_ROLE',
  FILE_TOO_LARGE: 'UPLOAD.FILE_TOO_LARGE',
  INVALID_MIME_TYPE: 'UPLOAD.INVALID_MIME_TYPE',
  STORAGE_ERROR: 'UPLOAD.STORAGE_ERROR',
} as const;

export type UploadErrorCode =
  (typeof UploadErrorCode)[keyof typeof UploadErrorCode];

const STATUS_BY_CODE: Readonly<Record<UploadErrorCode, number>> = {
  [UploadErrorCode.UPLOAD_NOT_FOUND]: 404,
  [UploadErrorCode.BOARD_NOT_FOUND]: 404,
  [UploadErrorCode.NOT_A_MEMBER]: 403,
  [UploadErrorCode.INSUFFICIENT_ROLE]: 403,
  [UploadErrorCode.FILE_TOO_LARGE]: 413,
  [UploadErrorCode.INVALID_MIME_TYPE]: 400,
  [UploadErrorCode.STORAGE_ERROR]: 500,
};

export class UploadException extends HttpException {
  constructor(code: UploadErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
