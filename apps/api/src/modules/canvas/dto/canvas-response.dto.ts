import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CanvasObjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  canvasId!: string;

  @ApiPropertyOptional()
  parentId?: string | null;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  x!: number;

  @ApiProperty()
  y!: number;

  @ApiProperty()
  width!: number;

  @ApiProperty()
  height!: number;

  @ApiProperty()
  rotation!: number;

  @ApiProperty()
  zIndex!: number;

  @ApiPropertyOptional()
  fill?: string | null;

  @ApiPropertyOptional()
  stroke?: string | null;

  @ApiProperty()
  strokeWidth!: number;

  @ApiProperty()
  opacity!: number;

  @ApiPropertyOptional()
  data?: Record<string, unknown> | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CanvasResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  boardId!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [CanvasObjectResponseDto] })
  objects!: CanvasObjectResponseDto[];
}
