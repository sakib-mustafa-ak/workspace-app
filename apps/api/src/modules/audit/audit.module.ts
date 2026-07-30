import { Module } from '@nestjs/common';

import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BoardsModule } from '../boards/boards.module';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { WorkspaceAuditHandler } from './handlers/workspace-audit.handler';
import { BoardAuditHandler } from './handlers/board-audit.handler';

@Module({
  imports: [WorkspacesModule, BoardsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, WorkspaceAuditHandler, BoardAuditHandler],
  exports: [AuditService],
})
export class AuditModule {}
