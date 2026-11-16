import { Module } from '@nestjs/common';

import { BoardsController } from './controllers/boards.controller';
import { BoardsEventBus } from './events/boards.events';
import { BoardPolicy } from './policies/board.policy';
import { BoardsRepository } from './repositories/boards.repository';
import { BoardColumnsRepository } from './repositories/board-columns.repository';
import { BoardsService } from './services/boards.service';
import { TasksModule } from '../tasks/tasks.module';
import { TrelloImportController } from './trello/trello-import.controller';
import { TrelloImportService } from './trello/trello-import.service';

@Module({
  imports: [TasksModule],
  controllers: [TrelloImportController, BoardsController],
  providers: [
    BoardsService,
    TrelloImportService,
    BoardsRepository,
    BoardColumnsRepository,
    BoardPolicy,
    BoardsEventBus,
  ],
  exports: [BoardsService, BoardsEventBus],
})
export class BoardsModule {}
