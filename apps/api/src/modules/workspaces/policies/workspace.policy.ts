import { Injectable } from '@nestjs/common';

import { type WorkspaceRole, WORKSPACE_ROLE_RANK } from '@repo/database';

@Injectable()
export class WorkspacePolicy {
  public canManage(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }

  public canEdit(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.EDITOR;
  }

  public canInvite(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }

  public canRemoveMembers(role: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK.ADMIN;
  }

  public canTransferOwnership(role: WorkspaceRole): boolean {
    return role === 'OWNER';
  }

  public isAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
    return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK[minimum];
  }

  public rank(role: WorkspaceRole): number {
    return WORKSPACE_ROLE_RANK[role];
  }
}
