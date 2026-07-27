import { ApiProperty } from '@nestjs/swagger';
import type { NotificationType, NotificationStatus } from '@repo/database';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: 'COMMENT_ADDED' })
  type!: NotificationType;

  @ApiProperty({ example: 'IN_APP' })
  channel!: string;

  @ApiProperty({ example: 'DELIVERED' })
  status!: NotificationStatus;

  @ApiProperty({ example: 'New comment on Sprint 24' })
  title!: string;

  @ApiProperty({ nullable: true })
  body!: string | null;

  @ApiProperty({ nullable: true })
  resourceType!: string | null;

  @ApiProperty({ nullable: true })
  resourceId!: string | null;

  @ApiProperty({ nullable: true })
  readAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
