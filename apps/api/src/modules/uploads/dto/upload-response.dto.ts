import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiPropertyOptional()
  boardId?: string | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  url!: string;

  @ApiProperty({
    description:
      'Fresh access-controlled download URL (presigned for S3-compatible storage).',
  })
  downloadUrl!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  createdAt!: Date;
}
