import { Test, TestingModule } from '@nestjs/testing';

import { WorkspaceAuditHandler } from './workspace-audit.handler';
import { AuditService } from '../services/audit.service';
import { WorkspacesEventBus } from '../../workspaces/events/workspaces.events';

describe('WorkspaceAuditHandler', () => {
  let handler: WorkspaceAuditHandler;
  let audit: { record: jest.Mock };
  let bus: WorkspacesEventBus;

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceAuditHandler,
        WorkspacesEventBus,
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    handler = module.get(WorkspaceAuditHandler);
    bus = module.get(WorkspacesEventBus);
    handler.onModuleInit();
  });

  it('records workspace.created via the event bus', () => {
    bus.publishWorkspaceCreated({ workspaceId: 'ws-1', ownerId: 'u-1' });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      metadata: {},
    });
  });

  it('records workspace.transferred via the event bus', () => {
    bus.publishWorkspaceTransferred({
      workspaceId: 'ws-1',
      previousOwnerId: 'u-1',
      newOwnerId: 'u-2',
      transferredBy: 'u-1',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'workspace.transferred',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      metadata: { previousOwnerId: 'u-1', newOwnerId: 'u-2' },
    });
  });
});
