import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { BoardsEventBus } from '../../boards/events/boards.events';

@Injectable()
export class BoardAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BoardsEventBus) private readonly events: BoardsEventBus,
  ) {}

  onModuleInit() {
    this.events.onBoardCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.createdBy,
        action: 'board.created',
        resourceType: 'board',
        resourceId: p.boardId,
        metadata: {},
      });
    });

    this.events.onBoardUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.updatedBy,
        action: 'board.updated',
        resourceType: 'board',
        resourceId: p.boardId,
        metadata: {},
      });
    });

    this.events.onBoardArchived((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.archivedBy,
        action: 'board.archived',
        resourceType: 'board',
        resourceId: p.boardId,
        metadata: {},
      });
    });

    this.events.onBoardDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'board.deleted',
        resourceType: 'board',
        resourceId: p.boardId,
        metadata: {},
      });
    });

    this.events.onColumnCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.createdBy,
        action: 'column.created',
        resourceType: 'column',
        resourceId: p.columnId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onColumnUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.updatedBy,
        action: 'column.updated',
        resourceType: 'column',
        resourceId: p.columnId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onColumnArchived((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.archivedBy,
        action: 'column.archived',
        resourceType: 'column',
        resourceId: p.columnId,
        metadata: { boardId: p.boardId },
      });
    });
  }
}
