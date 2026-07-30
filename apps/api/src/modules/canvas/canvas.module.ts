import { Module } from '@nestjs/common';

import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { CanvasController } from './controllers/canvas.controller';
import { CanvasEventBus } from './events/canvas.events';
import { CanvasPolicy } from './policies/canvas.policy';
import { CanvasRepository } from './repositories/canvas.repository';
import { CanvasService } from './services/canvas.service';

@Module({
  controllers: [CanvasController],
  providers: [
    CanvasService,
    CanvasRepository,
    BoardsRepository,
    WorkspaceMembersRepository,
    CanvasPolicy,
    CanvasEventBus,
  ],
  exports: [CanvasService, CanvasEventBus],
})
export class CanvasModule {}
