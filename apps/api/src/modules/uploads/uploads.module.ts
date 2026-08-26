import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { UploadsController } from './controllers/uploads.controller';
import { UploadsEventBus } from './events/uploads.events';
import { UploadPolicy } from './policies/upload.policy';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { UploadsRepository } from './repositories/uploads.repository';
import { UploadsService } from './services/uploads.service';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    UploadsRepository,
    BoardsRepository,
    WorkspaceMembersRepository,
    UploadPolicy,
    UploadsEventBus,
    // Driver selection happens once, at composition time. `s3` speaks to
    // any S3-compatible bucket (AWS S3 or Cloudflare R2 via S3_ENDPOINT);
    // env validation fails fast at boot if s3 settings are incomplete.
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) =>
        config.get<string>('storage.driver') === 's3'
          ? new S3StorageProvider(config)
          : new LocalStorageProvider(),
      inject: [ConfigService],
    },
  ],
  exports: [UploadsService, UploadsEventBus],
})
export class UploadsModule {}
