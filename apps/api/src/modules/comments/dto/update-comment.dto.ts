import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { COMMENT_CONTENT_MIN_LENGTH } from '@repo/database';

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated content.' })
  @IsString()
  @MinLength(COMMENT_CONTENT_MIN_LENGTH)
  @MaxLength(10000)
  content!: string;
}
