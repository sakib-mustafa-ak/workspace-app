import { Test, TestingModule } from '@nestjs/testing';

import { UploadAuditHandler } from './upload-audit.handler';
import { AuditService } from '../services/audit.service';
import { UploadsEventBus } from '../../uploads/events/uploads.events';

describe('UploadAuditHandler', () => {
  let handler: UploadAuditHandler;
  let audit: { record: jest.Mock };
  let bus: UploadsEventBus;

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadAuditHandler,
        UploadsEventBus,
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    handler = module.get(UploadAuditHandler);
    bus = module.get(UploadsEventBus);
    handler.onModuleInit();
  });

  it('records file.uploaded via the event bus', () => {
    bus.publishFileUploaded({
      fileId: 'f-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      userId: 'u-1',
      originalName: 'design.png',
      mimeType: 'image/png',
      size: 1024,
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'file.uploaded',
      resourceType: 'file',
      resourceId: 'f-1',
      metadata: { boardId: 'b-1', originalName: 'design.png' },
    });
  });

  it('records file.deleted via the event bus', () => {
    bus.publishFileDeleted({
      fileId: 'f-1',
      workspaceId: 'ws-1',
      deletedBy: 'u-2',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-2',
      action: 'file.deleted',
      resourceType: 'file',
      resourceId: 'f-1',
      metadata: {},
    });
  });
});
