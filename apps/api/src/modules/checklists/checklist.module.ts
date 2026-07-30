import { Module } from '@nestjs/common';

import { ChecklistController } from './controllers/checklist.controller';
import { ChecklistService } from './services/checklist.service';
import { ChecklistRepository } from './repositories/checklist.repository';
import { ChecklistPolicy } from './policies/checklist.policy';

@Module({
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistRepository, ChecklistPolicy],
  exports: [ChecklistService],
})
export class ChecklistModule {}
