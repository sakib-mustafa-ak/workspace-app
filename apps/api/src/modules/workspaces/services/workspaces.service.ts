import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import {
  DATABASE,
  eq,
  type Db,
  type WorkspaceRole,
  type WorkspaceRow,
  type WorkspaceMemberRow,
  type InvitationRow,
  WORKSPACE_SLUG_PATTERN,
  WORKSPACE_SLUG_MAX_LENGTH,
  MAX_PENDING_INVITATIONS_PER_WORKSPACE,
  workspaces,
  workspaceMembers,
  invitations,
} from '@repo/database';

import {
  WorkspacesErrorCode,
  WorkspacesException,
} from '../errors/workspaces.errors';
import { WorkspacePolicy } from '../policies/workspace.policy';
import { WorkspacesRepository } from '../repositories/workspaces.repository';
import { WorkspaceMembersRepository } from '../repositories/workspace-members.repository';
import { InvitationsRepository } from '../repositories/invitations.repository';
import { WorkspacesEventBus } from '../events/workspaces.events';
import {
  INVITATION_AUTH_TTL_SECONDS,
  INVITATION_TOKEN_BYTES,
} from '../workspaces.constants';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly workspacesRepo: WorkspacesRepository,
    private readonly members: WorkspaceMembersRepository,
    private readonly invitations: InvitationsRepository,
    private readonly policy: WorkspacePolicy,
    private readonly events: WorkspacesEventBus,
  ) {}

  public async create(
    userId: string,
    input: { name: string; slug: string; description?: string },
  ): Promise<WorkspaceRow> {
    this.validateSlug(input.slug);

    const existing = await this.workspacesRepo.findBySlug(input.slug);
    if (existing) {
      throw new WorkspacesException(
        WorkspacesErrorCode.SLUG_ALREADY_TAKEN,
        `Slug "${input.slug}" is already taken.`,
      );
    }

    const workspace = await this.db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          ownerId: userId,
        })
        .returning();
      if (!ws) throw new Error('Failed to insert workspace.');

      await tx.insert(workspaceMembers).values({
        workspaceId: ws.id,
        userId,
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date(),
      });

      return ws;
    });

    this.events.publishWorkspaceCreated({
      workspaceId: workspace.id,
      ownerId: userId,
    });

    return workspace;
  }

  public async getById(workspaceId: string): Promise<WorkspaceRow> {
    const ws = await this.workspacesRepo.findById(workspaceId);
    if (!ws) {
      throw new WorkspacesException(
        WorkspacesErrorCode.WORKSPACE_NOT_FOUND,
        'Workspace not found.',
      );
    }
    return ws;
  }

  public async update(
    workspaceId: string,
    userId: string,
    input: {
      name?: string;
      slug?: string;
      description?: string | null;
      logoUrl?: string | null;
      website?: string | null;
    },
  ): Promise<WorkspaceRow> {
    const ws = await this.workspacesRepo.findById(workspaceId);
    if (!ws) {
      throw new WorkspacesException(
        WorkspacesErrorCode.WORKSPACE_NOT_FOUND,
        'Workspace not found.',
      );
    }

    await this.requireRole(workspaceId, userId, 'ADMIN');

    if (input.slug && input.slug !== ws.slug) {
      this.validateSlug(input.slug);
      const slugExists = await this.workspacesRepo.findBySlug(input.slug);
      if (slugExists) {
        throw new WorkspacesException(
          WorkspacesErrorCode.SLUG_ALREADY_TAKEN,
          `Slug "${input.slug}" is already taken.`,
        );
      }
    }

    const updated = await this.workspacesRepo.update(workspaceId, input);
    this.events.publishWorkspaceUpdated({ workspaceId, updatedBy: userId });
    return updated;
  }

  public async archive(workspaceId: string, userId: string): Promise<void> {
    await this.requireRole(workspaceId, userId, 'ADMIN');
    await this.workspacesRepo.archive(workspaceId);
    this.events.publishWorkspaceArchived({ workspaceId, archivedBy: userId });
  }

  public async unarchive(workspaceId: string, userId: string): Promise<void> {
    await this.requireRole(workspaceId, userId, 'OWNER');
    await this.workspacesRepo.unarchive(workspaceId);
  }

  public async delete(workspaceId: string, userId: string): Promise<void> {
    await this.requireRole(workspaceId, userId, 'OWNER');
    await this.workspacesRepo.softDelete(workspaceId);
    this.events.publishWorkspaceDeleted({ workspaceId, deletedBy: userId });
  }

  public async listByUser(userId: string): Promise<WorkspaceRow[]> {
    return this.workspacesRepo.listByUser(userId);
  }

  public async getMembers(workspaceId: string): Promise<WorkspaceMemberRow[]> {
    const ws = await this.workspacesRepo.findById(workspaceId);
    if (!ws) {
      throw new WorkspacesException(
        WorkspacesErrorCode.WORKSPACE_NOT_FOUND,
        'Workspace not found.',
      );
    }
    return this.members.listByWorkspace(workspaceId);
  }

  public async changeMemberRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
  ): Promise<WorkspaceMemberRow> {
    await this.requireRole(workspaceId, actorId, 'ADMIN');

    const membership = await this.members.findByWorkspaceAndUser(
      workspaceId,
      targetUserId,
    );
    if (!membership) {
      throw new WorkspacesException(
        WorkspacesErrorCode.MEMBERSHIP_NOT_FOUND,
        'Membership not found.',
      );
    }
    if (membership.role === 'OWNER') {
      throw new WorkspacesException(
        WorkspacesErrorCode.CANNOT_REMOVE_OWNER,
        'Cannot change the owner role through this endpoint.',
      );
    }

    const oldRole = membership.role;
    const updated = await this.members.updateRole(
      workspaceId,
      targetUserId,
      newRole,
    );
    this.events.publishMemberRoleChanged({
      workspaceId,
      userId: targetUserId,
      oldRole,
      newRole,
    });
    return updated;
  }

  public async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireRole(workspaceId, actorId, 'ADMIN');

    const membership = await this.members.findByWorkspaceAndUser(
      workspaceId,
      targetUserId,
    );
    if (!membership) {
      throw new WorkspacesException(
        WorkspacesErrorCode.MEMBERSHIP_NOT_FOUND,
        'Membership not found.',
      );
    }
    if (membership.role === 'OWNER') {
      throw new WorkspacesException(
        WorkspacesErrorCode.CANNOT_REMOVE_OWNER,
        'Cannot remove the workspace owner.',
      );
    }

    await this.members.remove(workspaceId, targetUserId);
    this.events.publishMemberRemoved({ workspaceId, userId: targetUserId });
  }

  public async createInvitation(
    workspaceId: string,
    invitedByUserId: string,
    input: { email: string; role: WorkspaceRole },
  ): Promise<{ selector: string; verifier: string }> {
    await this.requireRole(workspaceId, invitedByUserId, 'ADMIN');

    const pendingCount =
      await this.invitations.countPendingByWorkspace(workspaceId);
    if (pendingCount >= MAX_PENDING_INVITATIONS_PER_WORKSPACE) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_NOT_FOUND,
        'Too many pending invitations.',
      );
    }

    const existing = await this.invitations.findPendingByEmail(
      workspaceId,
      input.email,
    );
    if (existing) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_ALREADY_ACCEPTED,
        'A pending invitation already exists for this email.',
      );
    }

    const { selector, verifierHash, verifier } = this.generateTokenPair();

    await this.invitations.create({
      workspaceId,
      email: input.email,
      role: input.role,
      selector,
      verifierHash,
      invitedById: invitedByUserId,
      expiresAt: new Date(Date.now() + INVITATION_AUTH_TTL_SECONDS * 1000),
    });

    this.events.publishInvitationCreated({
      workspaceId,
      email: input.email,
      invitedById: invitedByUserId,
    });

    return { selector, verifier };
  }

  public async acceptInvitation(
    selector: string,
    verifier: string,
    userId: string,
  ): Promise<{ workspaceId: string }> {
    const invitation = await this.invitations.findBySelector(selector);
    if (!invitation) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_NOT_FOUND,
        'Invitation not found.',
      );
    }

    const expectedHash = this.hashToken(selector + verifier);
    if (invitation.verifierHash !== expectedHash) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_NOT_FOUND,
        'Invalid invitation token.',
      );
    }

    if (invitation.status === 'ACCEPTED') {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_ALREADY_ACCEPTED,
        'Invitation already accepted.',
      );
    }
    if (invitation.status === 'REVOKED') {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_REVOKED,
        'Invitation has been revoked.',
      );
    }
    if (invitation.expiresAt < new Date()) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_EXPIRED,
        'Invitation has expired.',
      );
    }

    const existingMembership = await this.members.findByWorkspaceAndUser(
      invitation.workspaceId,
      userId,
    );
    if (existingMembership) {
      throw new WorkspacesException(
        WorkspacesErrorCode.ALREADY_A_MEMBER,
        'You are already a member of this workspace.',
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(invitations)
        .set({
          status: 'ACCEPTED',
          acceptedById: userId,
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invitations.id, invitation.id));

      await tx.insert(workspaceMembers).values({
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        status: 'ACTIVE',
        joinedAt: new Date(),
        invitationId: invitation.id,
      });
    });

    this.events.publishInvitationAccepted({
      workspaceId: invitation.workspaceId,
      userId,
      email: invitation.email,
    });
    this.events.publishMemberAdded({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    });

    return { workspaceId: invitation.workspaceId };
  }

  public async getInvitations(
    workspaceId: string,
    userId: string,
  ): Promise<InvitationRow[]> {
    await this.requireRole(workspaceId, userId, 'ADMIN');
    return this.invitations.listByWorkspace(workspaceId);
  }

  public async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    userId: string,
  ): Promise<void> {
    await this.requireRole(workspaceId, userId, 'ADMIN');

    const invitation = await this.invitations.findBySelector(invitationId);
    if (!invitation) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INVITATION_NOT_FOUND,
        'Invitation not found.',
      );
    }

    await this.invitations.revoke(invitation.id);
  }

  public async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberRow> {
    const membership = await this.members.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new WorkspacesException(
        WorkspacesErrorCode.NOT_A_MEMBER,
        'You are not a member of this workspace.',
      );
    }
    return membership;
  }

  private async requireRole(
    workspaceId: string,
    userId: string,
    minimumRole: WorkspaceRole,
  ): Promise<WorkspaceMemberRow> {
    const membership = await this.members.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new WorkspacesException(
        WorkspacesErrorCode.NOT_A_MEMBER,
        'You are not a member of this workspace.',
      );
    }
    if (!this.policy.isAtLeast(membership.role, minimumRole)) {
      throw new WorkspacesException(
        WorkspacesErrorCode.INSUFFICIENT_ROLE,
        `Requires ${minimumRole} role or higher.`,
      );
    }
    return membership;
  }

  private validateSlug(slug: string): void {
    if (slug.length > WORKSPACE_SLUG_MAX_LENGTH) {
      throw new WorkspacesException(
        WorkspacesErrorCode.WORKSPACE_NOT_FOUND,
        `Slug must be at most ${WORKSPACE_SLUG_MAX_LENGTH} characters.`,
      );
    }
    if (!WORKSPACE_SLUG_PATTERN.test(slug)) {
      throw new WorkspacesException(
        WorkspacesErrorCode.WORKSPACE_NOT_FOUND,
        'Slug must be lowercase alphanumeric with dashes.',
      );
    }
  }

  private generateTokenPair(): {
    selector: string;
    verifierHash: string;
    verifier: string;
  } {
    const selector = randomBytes(8).toString('hex');
    const verifier = randomBytes(INVITATION_TOKEN_BYTES).toString('hex');
    const verifierHash = this.hashToken(selector + verifier);
    return { selector, verifierHash, verifier };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
