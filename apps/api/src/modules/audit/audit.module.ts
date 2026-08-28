import { Module } from '@nestjs/common';

import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BoardsModule } from '../boards/boards.module';
import { TasksModule } from '../tasks/tasks.module';
import { CommentsModule } from '../comments/comments.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CanvasModule } from '../canvas/canvas.module';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { WorkspaceAuditHandler } from './handlers/workspace-audit.handler';
import { BoardAuditHandler } from './handlers/board-audit.handler';
import { TaskAuditHandler } from './handlers/task-audit.handler';
import { CommentAuditHandler } from './handlers/comment-audit.handler';
import { UploadAuditHandler } from './handlers/upload-audit.handler';
import { CanvasAuditHandler } from './handlers/canvas-audit.handler';

@Module({
  imports: [
    WorkspacesModule,
    BoardsModule,
    TasksModule,
    CommentsModule,
    UploadsModule,
    CanvasModule,
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditRepository,
    WorkspaceMembersRepository,
    BoardsRepository,
    WorkspaceAuditHandler,
    BoardAuditHandler,
    TaskAuditHandler,
    CommentAuditHandler,
    UploadAuditHandler,
    CanvasAuditHandler,
  ],
  exports: [AuditService],
})
export class AuditModule {}
