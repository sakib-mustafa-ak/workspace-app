import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty()
  displayName!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}

export class CommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  boardId!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ nullable: true })
  parentId!: string | null;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional({ type: CommentAuthorDto, nullable: true })
  author?: CommentAuthorDto | null;

  @ApiProperty({ nullable: true })
  editedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
