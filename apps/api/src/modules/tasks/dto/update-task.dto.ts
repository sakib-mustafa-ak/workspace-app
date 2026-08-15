import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  TASK_TITLE_MAX_LENGTH,
  TASK_TITLE_MIN_LENGTH,
  type TaskPriority,
  type TaskStatus,
} from '@repo/database';

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(TASK_TITLE_MIN_LENGTH)
  @MaxLength(TASK_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum([
    'TODO',
    'BACKLOG',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
    'CANCELLED',
  ] as const)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}
