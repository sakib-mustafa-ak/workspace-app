import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  TASK_TITLE_MAX_LENGTH,
  TASK_TITLE_MIN_LENGTH,
  type TaskPriority,
  type TaskStatus,
} from '@repo/database';

export class CreateTaskDto {
  @ApiProperty({ example: 'Set up CI/CD pipeline', minLength: 1 })
  @IsString()
  @MinLength(TASK_TITLE_MIN_LENGTH)
  @MaxLength(TASK_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ default: 'TODO' })
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

  @ApiPropertyOptional({ default: 'NONE' })
  @IsOptional()
  @IsEnum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  position?: number;
}
