import { Module } from '@nestjs/common';

import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsEventBus } from './events/notifications.events';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventBus,
  ],
  exports: [NotificationsService, NotificationsEventBus],
})
export class NotificationsModule {}
