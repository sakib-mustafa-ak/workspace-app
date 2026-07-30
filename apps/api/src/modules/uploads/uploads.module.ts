import { Module } from '@nestjs/common';

import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { UploadsController } from './controllers/uploads.controller';
import { UploadsEventBus } from './events/uploads.events';
import { UploadPolicy } from './policies/upload.policy';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { UploadsRepository } from './repositories/uploads.repository';
import { UploadsService } from './services/uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    UploadsRepository,
    BoardsRepository,
    WorkspaceMembersRepository,
    UploadPolicy,
    UploadsEventBus,
    LocalStorageProvider,
  ],
  exports: [UploadsService, UploadsEventBus],
})
export class UploadsModule {}
