import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';

import {
  and,
  DATABASE,
  eq,
  WORKSPACE_ROLE_RANK,
  workspaceMembers,
  type Db,
} from '@repo/database';

import { BoardsRepository } from '../../modules/boards/repositories/boards.repository';
import { TasksRepository } from '../../modules/tasks/repositories/tasks.repository';
import {
  WORKSPACE_ACCESS_KEY,
  type WorkspaceAccessRequirement,
} from '../decorators/workspace-access.decorator';

interface RequestUser {
  id: string;
}

interface GuardedRequest {
  user?: RequestUser;
  params?: Record<string, string>;
}

/**
 * Route-level authorization boundary for workspace-scoped endpoints.
 *
 * Services enforce their own membership checks (defense in depth), but a
 * boundary guard means the next service-layer mistake — like the board
 * read IDOR fixed in this codebase — fails closed instead of open.
 *
 * Registered globally after `JwtAuthGuard`; routes opt in with the
 * `@WorkspaceAccess()` decorator. Routes without it are untouched.
 */
@Injectable()
export class WorkspaceMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Inject(DATABASE) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      WorkspaceAccessRequirement | undefined
    >(WORKSPACE_ACCESS_KEY, [context.getHandler(), context.getClass()]);
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    if (!request.user?.id) {
      // Fail closed: this guard must never be the only thing assuming
      // authentication ran first.
      throw new UnauthorizedException('Authentication required.');
    }

    const workspaceId = await this.resolveWorkspaceId(request, requirement);
    if (!workspaceId) {
      throw new ForbiddenException('Workspace access denied.');
    }

    const [membership] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, request.user.id),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    const requiredRank = WORKSPACE_ROLE_RANK[requirement.minimumRole];
    const memberRank = membership
      ? WORKSPACE_ROLE_RANK[membership.role]
      : Number.NEGATIVE_INFINITY;

    if (!membership || memberRank < requiredRank) {
      // Identical response for non-members, missing workspaces, and
      // insufficient roles: no cross-tenant existence leak.
      throw new ForbiddenException('Workspace access denied.');
    }

    return true;
  }

  private async resolveWorkspaceId(
    request: GuardedRequest,
    requirement: WorkspaceAccessRequirement,
  ): Promise<string | undefined> {
    const params = request.params ?? {};

    if (requirement.param && params[requirement.param]) {
      return params[requirement.param];
    }
    if (params['workspaceId']) {
      return params['workspaceId'];
    }
    if (params['boardId']) {
      const boards = this.moduleRef.get(BoardsRepository, { strict: false });
      const board = await boards?.findById(params['boardId']);
      return board?.workspaceId;
    }
    if (params['taskId']) {
      const tasks = this.moduleRef.get(TasksRepository, { strict: false });
      const task = await tasks?.findById(params['taskId']);
      return task?.workspaceId;
    }
    return undefined;
  }
}
