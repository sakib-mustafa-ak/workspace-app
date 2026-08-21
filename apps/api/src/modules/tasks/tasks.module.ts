import { Module } from '@nestjs/common';

import {
  TasksController,
  GlobalTasksController,
} from './controllers/tasks.controller';
import { TasksEventBus } from './events/tasks.events';
import { TaskPolicy } from './policies/task.policy';
import { TasksRepository } from './repositories/tasks.repository';
import { TasksService } from './services/tasks.service';

@Module({
  controllers: [TasksController, GlobalTasksController],
  providers: [TasksService, TasksRepository, TaskPolicy, TasksEventBus],
  exports: [TasksService, TasksRepository, TasksEventBus],
})
export class TasksModule {}
