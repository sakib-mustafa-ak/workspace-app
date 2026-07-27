import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_LOCALE_LENGTH,
  MAX_TIMEZONE_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
} from '../users.constants';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Ada Lovelace', required: false })
  @IsOptional()
  @IsString()
  @MinLength(MIN_DISPLAY_NAME_LENGTH)
  @MaxLength(MAX_DISPLAY_NAME_LENGTH)
  displayName?: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiProperty({
    example: 'Mathematician and writer.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BIO_LENGTH)
  bio?: string | null;

  @ApiProperty({ example: 'America/New_York', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TIMEZONE_LENGTH)
  timezone?: string | null;

  @ApiProperty({ example: 'en-US', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCALE_LENGTH)
  locale?: string | null;
}
