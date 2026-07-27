import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { COLUMN_NAME_MAX_LENGTH, COLUMN_NAME_MIN_LENGTH } from '@repo/database';

export class CreateColumnDto {
  @ApiProperty({ example: 'In Progress', minLength: COLUMN_NAME_MIN_LENGTH })
  @IsString()
  @MinLength(COLUMN_NAME_MIN_LENGTH)
  @MaxLength(COLUMN_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  position?: number;
}
