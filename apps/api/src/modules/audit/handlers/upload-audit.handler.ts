import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { UploadsEventBus } from '../../uploads/events/uploads.events';

@Injectable()
export class UploadAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UploadsEventBus) private readonly events: UploadsEventBus,
  ) {}

  onModuleInit() {
    this.events.onFileUploaded((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'file.uploaded',
        resourceType: 'file',
        resourceId: p.fileId,
        metadata: { boardId: p.boardId ?? null, originalName: p.originalName },
      });
    });

    this.events.onFileDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'file.deleted',
        resourceType: 'file',
        resourceId: p.fileId,
        metadata: {},
      });
    });
  }
}
