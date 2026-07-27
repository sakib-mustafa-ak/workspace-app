import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { BOARD_NAME_MAX_LENGTH, BOARD_NAME_MIN_LENGTH } from '@repo/database';

export class UpdateBoardDto {
  @ApiProperty({ required: false, minLength: BOARD_NAME_MIN_LENGTH })
  @IsOptional()
  @IsString()
  @MinLength(BOARD_NAME_MIN_LENGTH)
  @MaxLength(BOARD_NAME_MAX_LENGTH)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string | null;
}
