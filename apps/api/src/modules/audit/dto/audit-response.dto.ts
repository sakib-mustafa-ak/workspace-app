import { ApiProperty } from '@nestjs/swagger';

export class AuditEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspaceId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ nullable: true }) resourceId!: string | null;
  @ApiProperty({ nullable: true }) metadata!: Record<string, unknown> | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class ActivityResponseDto {
  @ApiProperty({ type: [AuditEventDto] })
  data!: AuditEventDto[];

  @ApiProperty({ nullable: true })
  nextCursor!: string | null;
}
