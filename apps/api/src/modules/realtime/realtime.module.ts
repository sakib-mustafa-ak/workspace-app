import { Module } from '@nestjs/common';

import { CanvasModule } from '../canvas/canvas.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { CanvasGateway } from './gateways/canvas.gateway';

@Module({
  imports: [CanvasModule, UsersModule, NotificationsModule],
  providers: [CanvasGateway, BoardsRepository, WorkspaceMembersRepository],
  exports: [CanvasGateway],
})
export class RealtimeModule {}
