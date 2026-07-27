import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import type { WorkspaceRole } from '@repo/database';

const VALID_ROLES: WorkspaceRole[] = ['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'];

export class ChangeRoleDto {
  @ApiProperty({ example: 'EDITOR', enum: VALID_ROLES })
  @IsIn(VALID_ROLES)
  role!: WorkspaceRole;
}
