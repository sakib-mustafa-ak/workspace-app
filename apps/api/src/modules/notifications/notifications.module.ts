import { Module } from '@nestjs/common';

import { BoardsModule } from '../boards/boards.module';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { CommentsModule } from '../comments/comments.module';
import { TasksModule } from '../tasks/tasks.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsEventBus } from './events/notifications.events';
import { NotificationHandler } from './handlers/notification.handler';
import { NotificationPolicy } from './policies/notification.policy';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [
    BoardsModule,
    TasksModule,
    CommentsModule,
    WorkspacesModule,
    UploadsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventBus,
    NotificationPolicy,
    NotificationHandler,
    BoardsRepository,
    WorkspaceMembersRepository,
  ],
  exports: [NotificationsService, NotificationsEventBus],
})
export class NotificationsModule {}
