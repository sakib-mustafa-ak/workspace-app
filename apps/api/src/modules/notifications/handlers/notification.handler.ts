import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import type { BoardCreatedPayload } from '../../boards/events/boards.events';
import { BoardsEventBus } from '../../boards/events/boards.events';
import type { CommentCreatedPayload } from '../../comments/events/comments.events';
import { CommentsEventBus } from '../../comments/events/comments.events';
import type {
  TaskCreatedPayload,
  TaskUpdatedPayload,
  TaskDeletedPayload,
} from '../../tasks/events/tasks.events';
import { TasksEventBus } from '../../tasks/events/tasks.events';
import type {
  MemberAddedPayload,
  InvitationAcceptedPayload,
  InvitationCreatedPayload,
} from '../../workspaces/events/workspaces.events';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';
import type { FileUploadedPayload } from '../../uploads/events/uploads.events';
import { UploadsEventBus } from '../../uploads/events/uploads.events';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import {
  MAIL_PROVIDER,
  RecordingMailProvider,
} from '../../auth/mail/mail.provider';
import { UserRepository } from '../../auth/repositories/user.repository';

import { NotificationsService } from '../services/notifications.service';
import { NotificationPreferencesService } from '../services/notification-preferences.service';

@Injectable()
export class NotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(BoardsEventBus) private readonly boardsEventBus: BoardsEventBus,
    @Inject(CommentsEventBus)
    private readonly commentsEventBus: CommentsEventBus,
    @Inject(TasksEventBus) private readonly tasksEventBus: TasksEventBus,
    @Inject(WorkspacesEventBus)
    private readonly workspacesEventBus: WorkspacesEventBus,
    @Inject(UploadsEventBus) private readonly uploadsEventBus: UploadsEventBus,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembersRepo: WorkspaceMembersRepository,
    @Inject(BoardsRepository) private readonly boardsRepo: BoardsRepository,
    @Inject(MAIL_PROVIDER) private readonly mailProvider: RecordingMailProvider,
    @Inject(UserRepository) private readonly usersRepo: UserRepository,
    @Inject(NotificationPreferencesService)
    private readonly preferences: NotificationPreferencesService,
  ) {}

  public onModuleInit(): void {
    this.boardsEventBus.onBoardCreated((p) => {
      void this.handleBoardCreated(p);
    });
    this.boardsEventBus.onBoardArchived((p) => {
      void this.handleBoardArchived(p);
    });
    this.commentsEventBus.onCommentCreated((p) => {
      void this.handleCommentCreated(p);
    });
    this.tasksEventBus.onTaskCreated((p) => {
      void this.handleTaskCreated(p);
    });
    this.tasksEventBus.onTaskUpdated((p) => {
      void this.handleTaskUpdated(p);
    });
    this.tasksEventBus.onTaskDeleted((p) => {
      void this.handleTaskDeleted(p);
    });
    this.workspacesEventBus.onMemberAdded((p) => {
      void this.handleMemberAdded(p);
    });
    this.workspacesEventBus.onInvitationAccepted((p) => {
      void this.handleInvitationAccepted(p);
    });
    this.workspacesEventBus.onInvitationCreated((p) => {
      void this.handleInvitationCreated(p);
    });
    this.uploadsEventBus.onFileUploaded((p) => {
      void this.handleFileUploaded(p);
    });
    this.logger.log('Notification handlers registered');
  }

  private async handleBoardCreated(
    payload: BoardCreatedPayload,
  ): Promise<void> {
    try {
      const members = await this.workspaceMembersRepo.listByWorkspace(
        payload.workspaceId,
      );
      for (const m of members) {
        if (m.userId === payload.createdBy) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'BOARD_SHARED',
          title: 'New board created',
          body: undefined,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle BoardCreated', err);
    }
  }

  private async handleBoardArchived(payload: {
    boardId: string;
    archivedBy: string;
  }): Promise<void> {
    try {
      const board = await this.boardsRepo.findById(payload.boardId);
      if (!board) return;
      const members = await this.workspaceMembersRepo.listByWorkspace(
        board.workspaceId,
      );
      for (const m of members) {
        if (m.userId === payload.archivedBy) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'BOARD_SHARED',
          title: 'Board archived',
          body: undefined,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle BoardArchived', err);
    }
  }

  private async handleCommentCreated(
    payload: CommentCreatedPayload,
  ): Promise<void> {
    try {
      const board = await this.boardsRepo.findById(payload.boardId);
      if (!board) return;
      const members = await this.workspaceMembersRepo.listByWorkspace(
        board.workspaceId,
      );
      for (const m of members) {
        if (m.userId === payload.userId) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'COMMENT_ADDED',
          title: 'New comment on board',
          body: undefined,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle CommentCreated', err);
    }
  }

  private async handleTaskCreated(payload: TaskCreatedPayload): Promise<void> {
    if (!payload.assigneeId || payload.assigneeId === payload.createdBy) return;
    try {
      await this.notifications.createAndDeliver(payload.assigneeId, {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: payload.title,
        resourceType: 'task',
        resourceId: payload.taskId,
      });

      const emailEnabled = await this.preferences.isEmailEnabled(
        payload.assigneeId,
        'TASK_ASSIGNED',
      );
      if (emailEnabled) {
        const assignee = await this.usersRepo.findById(payload.assigneeId);
        if (assignee) {
          await this.mailProvider.send({
            to: assignee.email,
            subject: 'You were assigned a task',
            text: payload.title,
          });
        }
      }
    } catch (err) {
      this.logger.error('Failed to handle TaskCreated', err);
    }
  }

  private async handleTaskUpdated(payload: TaskUpdatedPayload): Promise<void> {
    if (payload.assigneeId === payload.previousAssigneeId) return;
    try {
      if (payload.assigneeId && payload.assigneeId !== payload.updatedBy) {
        await this.notifications.createAndDeliver(payload.assigneeId, {
          type: 'TASK_ASSIGNED',
          title: 'You were assigned a task',
          body: payload.title,
          resourceType: 'task',
          resourceId: payload.taskId,
        });
      }
      if (
        payload.previousAssigneeId &&
        payload.previousAssigneeId !== payload.updatedBy
      ) {
        await this.notifications.createAndDeliver(payload.previousAssigneeId, {
          type: 'TASK_UNASSIGNED',
          title: 'You were unassigned from a task',
          body: payload.title,
          resourceType: 'task',
          resourceId: payload.taskId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle TaskUpdated', err);
    }
  }

  private async handleTaskDeleted(payload: TaskDeletedPayload): Promise<void> {
    // The assignee should hear about a task disappearing, unless they
    // deleted it themselves.
    if (!payload.assigneeId || payload.assigneeId === payload.deletedBy) return;
    try {
      await this.notifications.createAndDeliver(payload.assigneeId, {
        type: 'TASK_DELETED',
        title: 'A task you were assigned was deleted',
        body: payload.title,
        resourceType: 'task',
        resourceId: payload.taskId,
      });
    } catch (err) {
      this.logger.error('Failed to handle TaskDeleted', err);
    }
  }

  private async handleMemberAdded(payload: MemberAddedPayload): Promise<void> {
    try {
      await this.notifications.createAndDeliver(payload.userId, {
        type: 'MEMBER_ADDED',
        title: 'You were added to a workspace',
        body: undefined,
        resourceType: 'workspace',
        resourceId: payload.workspaceId,
      });
    } catch (err) {
      this.logger.error('Failed to handle MemberAdded', err);
    }
  }

  private async handleInvitationCreated(
    payload: InvitationCreatedPayload,
  ): Promise<void> {
    try {
      const target = await this.usersRepo.findByEmail(payload.email);
      if (!target) return;
      const emailEnabled = await this.preferences.isEmailEnabled(
        target.id,
        'MEMBER_ADDED',
      );
      if (!emailEnabled) return;
      await this.mailProvider.send({
        to: target.email,
        subject: 'You were invited to a workspace',
        text: 'Open your dashboard to accept the invitation.',
      });
    } catch (err) {
      this.logger.error('Failed to send invitation email', err);
    }
  }

  private async handleInvitationAccepted(
    payload: InvitationAcceptedPayload,
  ): Promise<void> {
    try {
      const members = await this.workspaceMembersRepo.listByWorkspace(
        payload.workspaceId,
      );
      for (const m of members) {
        if (m.userId === payload.userId) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'INVITATION_ACCEPTED',
          title: 'New member joined the workspace',
          body: undefined,
          resourceType: 'workspace',
          resourceId: payload.workspaceId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle InvitationAccepted', err);
    }
  }

  private async handleFileUploaded(
    payload: FileUploadedPayload,
  ): Promise<void> {
    if (!payload.boardId) return;
    try {
      const board = await this.boardsRepo.findById(payload.boardId);
      if (!board) return;
      const members = await this.workspaceMembersRepo.listByWorkspace(
        board.workspaceId,
      );
      for (const m of members) {
        if (m.userId === payload.userId) continue;
        await this.notifications.createAndDeliver(m.userId, {
          type: 'FILE_UPLOADED',
          title: 'File uploaded to board',
          body: payload.originalName,
          resourceType: 'board',
          resourceId: payload.boardId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle FileUploaded', err);
    }
  }
}
