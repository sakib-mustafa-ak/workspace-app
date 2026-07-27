import { Injectable } from '@nestjs/common';

import { type WorkspaceRole, WORKSPACE_ROLE_RANK } from '@repo/database';

@Injectable()
export class CommentPolicy {
  public canManage(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }

  public canComment(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.COMMENTER;
  }

  public canView(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.VIEWER;
  }

  public isAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK[minimum];
  }

  public canDeleteComment(role: WorkspaceRole, isOwner: boolean): boolean {
    if (isOwner) return true;
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }

  public canEditComment(role: WorkspaceRole, isOwner: boolean): boolean {
    if (!isOwner) return false;
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.COMMENTER;
  }
}
