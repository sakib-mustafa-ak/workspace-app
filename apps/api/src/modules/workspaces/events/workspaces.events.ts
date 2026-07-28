import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type WorkspaceCreatedPayload = {
  workspaceId: string;
  ownerId: string;
};

export type WorkspaceUpdatedPayload = {
  workspaceId: string;
  updatedBy: string;
};

export type WorkspaceArchivedPayload = {
  workspaceId: string;
  archivedBy: string;
};

export type WorkspaceDeletedPayload = {
  workspaceId: string;
  deletedBy: string;
};

export type MemberAddedPayload = {
  workspaceId: string;
  userId: string;
  role: string;
};

export type MemberRoleChangedPayload = {
  workspaceId: string;
  userId: string;
  oldRole: string;
  newRole: string;
};

export type MemberRemovedPayload = {
  workspaceId: string;
  userId: string;
};

export type InvitationCreatedPayload = {
  workspaceId: string;
  email: string;
  invitedById: string;
};

export type InvitationAcceptedPayload = {
  workspaceId: string;
  userId: string;
  email: string;
};

export const WORKSPACES_EVENTS = {
  workspaceCreated: 'WorkspaceCreated',
  workspaceUpdated: 'WorkspaceUpdated',
  workspaceArchived: 'WorkspaceArchived',
  workspaceDeleted: 'WorkspaceDeleted',
  memberAdded: 'MemberAdded',
  memberRoleChanged: 'MemberRoleChanged',
  memberRemoved: 'MemberRemoved',
  invitationCreated: 'InvitationCreated',
  invitationAccepted: 'InvitationAccepted',
} as const;

export type WorkspacesEventName =
  (typeof WORKSPACES_EVENTS)[keyof typeof WORKSPACES_EVENTS];

@Injectable()
export class WorkspacesEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishWorkspaceCreated(payload: WorkspaceCreatedPayload): void {
    this.emit(WORKSPACES_EVENTS.workspaceCreated, payload);
  }

  onWorkspaceCreated(
    listener: (payload: WorkspaceCreatedPayload) => void,
  ): void {
    this.emitter.on(WORKSPACES_EVENTS.workspaceCreated, listener);
  }

  publishWorkspaceUpdated(payload: WorkspaceUpdatedPayload): void {
    this.emit(WORKSPACES_EVENTS.workspaceUpdated, payload);
  }

  publishWorkspaceArchived(payload: WorkspaceArchivedPayload): void {
    this.emit(WORKSPACES_EVENTS.workspaceArchived, payload);
  }

  publishWorkspaceDeleted(payload: WorkspaceDeletedPayload): void {
    this.emit(WORKSPACES_EVENTS.workspaceDeleted, payload);
  }

  publishMemberAdded(payload: MemberAddedPayload): void {
    this.emit(WORKSPACES_EVENTS.memberAdded, payload);
  }

  onMemberAdded(listener: (payload: MemberAddedPayload) => void): void {
    this.emitter.on(WORKSPACES_EVENTS.memberAdded, listener);
  }

  publishMemberRoleChanged(payload: MemberRoleChangedPayload): void {
    this.emit(WORKSPACES_EVENTS.memberRoleChanged, payload);
  }

  publishMemberRemoved(payload: MemberRemovedPayload): void {
    this.emit(WORKSPACES_EVENTS.memberRemoved, payload);
  }

  publishInvitationCreated(payload: InvitationCreatedPayload): void {
    this.emit(WORKSPACES_EVENTS.invitationCreated, payload);
  }

  publishInvitationAccepted(payload: InvitationAcceptedPayload): void {
    this.emit(WORKSPACES_EVENTS.invitationAccepted, payload);
  }

  onInvitationAccepted(
    listener: (payload: InvitationAcceptedPayload) => void,
  ): void {
    this.emitter.on(WORKSPACES_EVENTS.invitationAccepted, listener);
  }

  private emit(name: WorkspacesEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
