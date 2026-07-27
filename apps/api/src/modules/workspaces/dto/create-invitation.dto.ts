import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';

import type { WorkspaceRole } from '@repo/database';

const VALID_ROLES: WorkspaceRole[] = ['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'];

export class CreateInvitationDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'EDITOR', enum: VALID_ROLES })
  @IsIn(VALID_ROLES)
  role!: WorkspaceRole;
}
