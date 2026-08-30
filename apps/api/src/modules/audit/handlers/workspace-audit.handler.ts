import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';

@Injectable()
export class WorkspaceAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkspacesEventBus) private readonly events: WorkspacesEventBus,
  ) {}

  onModuleInit() {
    this.events.onWorkspaceCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.ownerId,
        action: 'workspace.created',
        resourceType: 'workspace',
        resourceId: p.workspaceId,
        metadata: {},
      });
    });

    this.events.onWorkspaceUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.updatedBy,
        action: 'workspace.updated',
        resourceType: 'workspace',
        resourceId: p.workspaceId,
        metadata: {},
      });
    });

    this.events.onWorkspaceArchived((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.archivedBy,
        action: 'workspace.archived',
        resourceType: 'workspace',
        resourceId: p.workspaceId,
        metadata: {},
      });
    });

    this.events.onWorkspaceDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'workspace.deleted',
        resourceType: 'workspace',
        resourceId: p.workspaceId,
        metadata: {},
      });
    });

    this.events.onMemberAdded((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'member.added',
        resourceType: 'member',
        resourceId: p.userId,
        metadata: { role: p.role },
      });
    });

    this.events.onMemberRoleChanged((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'member.role_changed',
        resourceType: 'member',
        resourceId: p.userId,
        metadata: { oldRole: p.oldRole, newRole: p.newRole },
      });
    });

    this.events.onMemberRemoved((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'member.removed',
        resourceType: 'member',
        resourceId: p.userId,
        metadata: {},
      });
    });

    this.events.onInvitationCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.invitedById,
        action: 'invitation.created',
        resourceType: 'invitation',
        resourceId: p.email,
        metadata: { email: p.email },
      });
    });

    this.events.onInvitationAccepted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'invitation.accepted',
        resourceType: 'invitation',
        resourceId: p.email,
        metadata: { email: p.email },
      });
    });

    this.events.onWorkspaceTransferred((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.transferredBy,
        action: 'workspace.transferred',
        resourceType: 'workspace',
        resourceId: p.workspaceId,
        metadata: {
          previousOwnerId: p.previousOwnerId,
          newOwnerId: p.newOwnerId,
        },
      });
    });
  }
}
