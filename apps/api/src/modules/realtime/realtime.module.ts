import { Module } from '@nestjs/common';

import { CanvasModule } from '../canvas/canvas.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CanvasGateway } from './gateways/canvas.gateway';

@Module({
  imports: [CanvasModule, UsersModule, NotificationsModule],
  providers: [CanvasGateway],
  exports: [CanvasGateway],
})
export class RealtimeModule {}
