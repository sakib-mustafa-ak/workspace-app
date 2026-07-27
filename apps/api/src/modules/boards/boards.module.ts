import { Module } from '@nestjs/common';

import { BoardsController } from './controllers/boards.controller';
import { BoardsEventBus } from './events/boards.events';
import { BoardPolicy } from './policies/board.policy';
import { BoardsRepository } from './repositories/boards.repository';
import { BoardColumnsRepository } from './repositories/board-columns.repository';
import { BoardsService } from './services/boards.service';

@Module({
  controllers: [BoardsController],
  providers: [
    BoardsService,
    BoardsRepository,
    BoardColumnsRepository,
    BoardPolicy,
    BoardsEventBus,
  ],
  exports: [BoardsService, BoardsEventBus],
})
export class BoardsModule {}
