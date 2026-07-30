import { Injectable } from '@nestjs/common';

import { type WorkspaceRole, WORKSPACE_ROLE_RANK } from '@repo/database';

@Injectable()
export class CanvasPolicy {
  public canManage(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }

  public canEdit(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.EDITOR;
  }

  public canView(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.VIEWER;
  }

  public isAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK[minimum];
  }
}
