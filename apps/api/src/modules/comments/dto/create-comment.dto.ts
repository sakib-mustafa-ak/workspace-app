import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { COMMENT_CONTENT_MIN_LENGTH } from '@repo/database';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great idea! Let me add some details.' })
  @IsString()
  @MinLength(COMMENT_CONTENT_MIN_LENGTH)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Parent comment ID for threaded replies',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
