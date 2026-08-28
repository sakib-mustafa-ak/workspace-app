import { Test, TestingModule } from '@nestjs/testing';

import { CanvasAuditHandler } from './canvas-audit.handler';
import { AuditService } from '../services/audit.service';
import { CanvasEventBus } from '../../canvas/events/canvas.events';

describe('CanvasAuditHandler', () => {
  let handler: CanvasAuditHandler;
  let audit: { record: jest.Mock };
  let bus: CanvasEventBus;

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasAuditHandler,
        CanvasEventBus,
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    handler = module.get(CanvasAuditHandler);
    bus = module.get(CanvasEventBus);
    handler.onModuleInit();
  });

  it('records canvas.object.created via the event bus', () => {
    bus.publishObjectCreated({
      objectId: 'o-1',
      workspaceId: 'ws-1',
      canvasId: 'cv-1',
      boardId: 'b-1',
      userId: 'u-1',
      type: 'RECTANGLE',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'canvas.object.created',
      resourceType: 'canvas_object',
      resourceId: 'o-1',
      metadata: { canvasId: 'cv-1', boardId: 'b-1', type: 'RECTANGLE' },
    });
  });

  it('records canvas.object.updated via the event bus', () => {
    bus.publishObjectUpdated({
      objectId: 'o-1',
      workspaceId: 'ws-1',
      canvasId: 'cv-1',
      boardId: 'b-1',
      userId: 'u-1',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'canvas.object.updated',
      resourceType: 'canvas_object',
      resourceId: 'o-1',
      metadata: { canvasId: 'cv-1', boardId: 'b-1' },
    });
  });

  it('records canvas.object.deleted via the event bus', () => {
    bus.publishObjectDeleted({
      objectId: 'o-1',
      workspaceId: 'ws-1',
      canvasId: 'cv-1',
      boardId: 'b-1',
      deletedBy: 'u-2',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-2',
      action: 'canvas.object.deleted',
      resourceType: 'canvas_object',
      resourceId: 'o-1',
      metadata: { canvasId: 'cv-1', boardId: 'b-1' },
    });
  });
});
