import { ApiProperty } from '@nestjs/swagger';
import type { BoardStatus } from '@repo/database';

export class BoardResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ example: 'Sprint 24' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  position!: number;

  @ApiProperty({ example: 'ACTIVE' })
  status!: BoardStatus;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class BoardColumnResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  boardId!: string;

  @ApiProperty({ example: 'To Do' })
  name!: string;

  @ApiProperty()
  position!: number;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
