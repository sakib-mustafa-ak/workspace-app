import { Global, Module } from '@nestjs/common';
import { BoardAccessService } from './board-access.service';
import { BoardPresenceService } from './board-presence.service';
import { WorkspaceHomeController } from './workspace-home.controller';
import { WorkspaceHomeService } from './workspace-home.service';

@Global()
@Module({
  providers: [BoardAccessService, BoardPresenceService, WorkspaceHomeService],
  exports: [BoardAccessService, BoardPresenceService],
  controllers: [WorkspaceHomeController],
})
export class BoardAccessModule {}
