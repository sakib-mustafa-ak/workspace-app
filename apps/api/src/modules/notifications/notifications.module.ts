import { Module } from '@nestjs/common';

import { BoardsModule } from '../boards/boards.module';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { CommentsModule } from '../comments/comments.module';
import { TasksModule } from '../tasks/tasks.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { NotificationsController } from './controllers/notifications.controller';
import { PushSubscriptionsController } from './controllers/push-subscriptions.controller';
import { NotificationsEventBus } from './events/notifications.events';
import { NotificationHandler } from './handlers/notification.handler';
import { NotificationPolicy } from './policies/notification.policy';
import { NotificationsRepository } from './repositories/notifications.repository';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { NotificationsService } from './services/notifications.service';
import { PushSubscriptionsService } from './services/push-subscriptions.service';
import { WebPushService } from './services/web-push.service';

@Module({
  imports: [
    BoardsModule,
    TasksModule,
    CommentsModule,
    WorkspacesModule,
    UploadsModule,
  ],
  controllers: [NotificationsController, PushSubscriptionsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventBus,
    NotificationPolicy,
    NotificationHandler,
    PushSubscriptionsService,
    PushSubscriptionsRepository,
    WebPushService,
    BoardsRepository,
    WorkspaceMembersRepository,
  ],
  exports: [
    NotificationsService,
    NotificationsEventBus,
    PushSubscriptionsService,
    WebPushService,
  ],
})
export class NotificationsModule {}
