import { Module } from '@nestjs/common';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { TasksRepository } from '../tasks/repositories/tasks.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { SearchController } from './controllers/search.controller';
import { SearchService } from './services/search.service';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    BoardsRepository,
    TasksRepository,
    WorkspaceMembersRepository,
  ],
  exports: [SearchService],
})
export class SearchModule {}
