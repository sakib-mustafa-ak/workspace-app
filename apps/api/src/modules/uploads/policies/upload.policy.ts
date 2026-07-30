import { Injectable } from '@nestjs/common';

import { type WorkspaceRole, WORKSPACE_ROLE_RANK } from '@repo/database';

@Injectable()
export class UploadPolicy {
  public canUpload(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.EDITOR;
  }

  public canView(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.VIEWER;
  }

  public canManage(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }
}
