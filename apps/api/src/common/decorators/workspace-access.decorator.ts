import { SetMetadata } from '@nestjs/common';

import type { WorkspaceRole } from '@repo/database';

/**
 * Route-level authorization requirement resolved by
 * {@link WorkspaceMembershipGuard} before a handler runs.
 */
export interface WorkspaceAccessRequirement {
  /** Minimum active role the requester must hold in the workspace. */
  minimumRole: WorkspaceRole;
  /**
   * Explicit request-param name holding the workspace id. Only needed when
   * the route does not use `:workspaceId` (e.g. audit uses `workspaces/:id`).
   * Otherwise the guard resolves workspaceId directly or through the
   * boardId/taskId ownership chain.
   */
  param?: string;
}

export const WORKSPACE_ACCESS_KEY = 'workspace.access';

/**
 * Declares that a route requires an active workspace membership with at
 * least `minimumRole`. Enforced at the controller boundary so a future
 * service-layer regression fails closed instead of open.
 *
 * Resolution order for the workspace id:
 *   1. `options.param` named request param (explicit override)
 *   2. `:workspaceId` request param
 *   3. `:boardId` param resolved through the board's owning workspace
 *   4. `:taskId` param resolved through the task's owning workspace
 *
 * If none resolves, access is denied.
 */
export function WorkspaceAccess(
  minimumRole: WorkspaceRole = 'VIEWER',
  options?: { param?: string },
): MethodDecorator & ClassDecorator {
  const requirement: WorkspaceAccessRequirement = {
    minimumRole,
    ...(options ?? {}),
  };
  return SetMetadata(WORKSPACE_ACCESS_KEY, requirement);
}
