import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../auth.constants';

/**
 * Body for `POST /auth/reset-password`.
 *
 * The DTO accepts the same canonical `selector.verifier` token shape
 * as `VerifyEmailDto` so the front-end can reuse a single parser.
 *
 * `newPassword` is validated by class-validator before the request
 * hits the service. The service re-checks via the same constants
 * from `auth.constants.ts` (single source of truth for password rules).
 */
export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Opaque token from the password-reset email link (selector.verifier).',
  })
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
    description: 'New password. Min 12 chars with mixed case, digit, symbol.',
    example: 'Br@nd-new-passphrase-2026',
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  newPassword!: string;
}
