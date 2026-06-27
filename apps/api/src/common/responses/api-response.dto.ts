import { ApiProperty } from '@nestjs/swagger';

/**
 * Stable success response envelope.
 *
 * Every controller returns this shape. Concrete document type is plugged in
 * at usage time so Swagger generation remains accurate.
 */
export class ApiSuccessResponse<T> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Request successful.' })
  message!: string;

  @ApiProperty()
  data!: T;
}

/**
 * Stable error response envelope for business errors.
 */
export class ApiErrorResponse {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Resource not found.' })
  message!: string;

  @ApiProperty({ example: { code: 'USER_NOT_FOUND' }, required: false })
  error?: { code: string };
}

/**
 * Validation error envelope returned by the global ValidationPipe.
 */
export class ApiValidationError {
  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'Invalid email.' })
  message!: string;
}
