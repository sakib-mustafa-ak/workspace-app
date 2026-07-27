import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ nullable: true })
  editedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
