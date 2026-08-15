import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../auth.constants';

export class RegisterDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 12,
    description: 'Min 12 chars with mixed case, digit and symbol.',
    example: 'S0lid-passphrase!',
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, one digit and one symbol.',
  })
  password!: string;
}
