import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import {
  WORKSPACE_NAME_MAX_LENGTH,
  WORKSPACE_NAME_MIN_LENGTH,
  WORKSPACE_SLUG_MAX_LENGTH,
} from '@repo/database';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'My Team', minLength: WORKSPACE_NAME_MIN_LENGTH })
  @IsString()
  @MinLength(WORKSPACE_NAME_MIN_LENGTH)
  @MaxLength(WORKSPACE_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ example: 'my-team' })
  @IsString()
  @MaxLength(WORKSPACE_SLUG_MAX_LENGTH)
  slug!: string;

  @ApiProperty({
    example: 'Team workspace for project collaboration',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
