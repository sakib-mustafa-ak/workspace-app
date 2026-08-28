import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { CanvasEventBus } from '../../canvas/events/canvas.events';

@Injectable()
export class CanvasAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CanvasEventBus) private readonly events: CanvasEventBus,
  ) {}

  onModuleInit() {
    this.events.onObjectCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'canvas.object.created',
        resourceType: 'canvas_object',
        resourceId: p.objectId,
        metadata: { canvasId: p.canvasId, boardId: p.boardId, type: p.type },
      });
    });

    this.events.onObjectUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'canvas.object.updated',
        resourceType: 'canvas_object',
        resourceId: p.objectId,
        metadata: { canvasId: p.canvasId, boardId: p.boardId },
      });
    });

    this.events.onObjectDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'canvas.object.deleted',
        resourceType: 'canvas_object',
        resourceId: p.objectId,
        metadata: { canvasId: p.canvasId, boardId: p.boardId },
      });
    });
  }
}
