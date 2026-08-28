import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BoardsModule } from '../boards/boards.module';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { CommentsModule } from '../comments/comments.module';
import { TasksModule } from '../tasks/tasks.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsEventBus } from './events/notifications.events';
import { NotificationHandler } from './handlers/notification.handler';
import { NotificationPolicy } from './policies/notification.policy';
import { NotificationPreferencesRepository } from './repositories/notification-preferences.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [
    AuthModule,
    BoardsModule,
    TasksModule,
    CommentsModule,
    WorkspacesModule,
    UploadsModule,
  ],
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventBus,
    NotificationPolicy,
    NotificationHandler,
    BoardsRepository,
    WorkspaceMembersRepository,
    NotificationPreferencesService,
    NotificationPreferencesRepository,
  ],
  exports: [NotificationsService, NotificationsEventBus],
})
export class NotificationsModule {}
