import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { BOARD_NAME_MAX_LENGTH, BOARD_NAME_MIN_LENGTH } from '@repo/database';

export class CreateBoardDto {
  @ApiProperty({ example: 'Sprint 24', minLength: BOARD_NAME_MIN_LENGTH })
  @IsString()
  @MinLength(BOARD_NAME_MIN_LENGTH)
  @MaxLength(BOARD_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ example: 'Tasks for the current sprint', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string;
}
