import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CHECKLIST_TEXT_MAX_LENGTH,
  CHECKLIST_TEXT_MIN_LENGTH,
} from '@repo/database';

export class UpdateChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(CHECKLIST_TEXT_MIN_LENGTH)
  @MaxLength(CHECKLIST_TEXT_MAX_LENGTH)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}
