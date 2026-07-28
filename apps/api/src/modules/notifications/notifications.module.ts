import { Module } from '@nestjs/common';

import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { BoardsEventBus } from '../boards/events/boards.events';
import { CommentsEventBus } from '../comments/events/comments.events';
import { TasksEventBus } from '../tasks/events/tasks.events';
import { WorkspacesEventBus } from '../workspaces/events/workspaces.events';
import { UploadsEventBus } from '../uploads/events/uploads.events';

import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsEventBus } from './events/notifications.events';
import { NotificationHandler } from './handlers/notification.handler';
import { NotificationPolicy } from './policies/notification.policy';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventBus,
    NotificationPolicy,
    NotificationHandler,
    BoardsRepository,
    WorkspaceMembersRepository,
    BoardsEventBus,
    CommentsEventBus,
    TasksEventBus,
    WorkspacesEventBus,
    UploadsEventBus,
  ],
  exports: [NotificationsService, NotificationsEventBus],
})
export class NotificationsModule {}
