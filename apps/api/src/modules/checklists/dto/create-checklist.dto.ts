import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CHECKLIST_TEXT_MAX_LENGTH,
  CHECKLIST_TEXT_MIN_LENGTH,
} from '@repo/database';

export class CreateChecklistDto {
  @ApiProperty()
  @IsString()
  @MinLength(CHECKLIST_TEXT_MIN_LENGTH)
  @MaxLength(CHECKLIST_TEXT_MAX_LENGTH)
  text!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position?: number;
}
