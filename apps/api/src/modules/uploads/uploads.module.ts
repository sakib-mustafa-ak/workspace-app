import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';

import { UploadsController } from './controllers/uploads.controller';
import { UploadsEventBus } from './events/uploads.events';
import { UploadPolicy } from './policies/upload.policy';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { VercelBlobStorageProvider } from './providers/vercel-blob.provider';
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
    // `vercel-blob` targets a Vercel Blob store. The default stays `local`.
    // Env validation fails fast at boot when a driver's settings are
    // incomplete, so no provider ever sees a missing token.
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('storage.driver');
        if (driver === 's3') {
          return new S3StorageProvider(config);
        }
        if (driver === 'vercel-blob') {
          return new VercelBlobStorageProvider(config);
        }
        return new LocalStorageProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [UploadsService, UploadsEventBus],
})
export class UploadsModule {}
