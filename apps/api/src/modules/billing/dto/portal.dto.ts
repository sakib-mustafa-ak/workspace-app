import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PortalDto {
  @ApiProperty()
  @IsUUID()
  workspaceId!: string;
}
