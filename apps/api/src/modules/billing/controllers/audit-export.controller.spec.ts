import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/services/audit.service';
import { UsageService } from '../services/usage.service';
import { AuditExportController } from './audit-export.controller';

describe('AuditExportController', () => {
  let controller: AuditExportController;
  let usage: { requireFeature: jest.Mock };
  let audit: { exportWorkspace: jest.Mock };

  beforeEach(async () => {
    usage = { requireFeature: jest.fn() };
    audit = { exportWorkspace: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AuditExportController],
      providers: [
        { provide: UsageService, useValue: usage },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = module.get(AuditExportController);
  });

  it('gates the export behind AUDIT_LOG_EXPORT', async () => {
    usage.requireFeature.mockRejectedValue(
      new Error('BILLING.FEATURE_REQUIRED'),
    );
    await expect(controller.exportAudit('ws-1', 'json')).rejects.toThrow(
      'BILLING.FEATURE_REQUIRED',
    );
    expect(usage.requireFeature).toHaveBeenCalledWith(
      'ws-1',
      'AUDIT_LOG_EXPORT',
    );
  });

  it('returns a downloadable payload for TEAM workspaces', async () => {
    usage.requireFeature.mockResolvedValue(undefined);
    audit.exportWorkspace.mockResolvedValue([]);
    const res = await controller.exportAudit('ws-1', 'csv');
    expect(audit.exportWorkspace).toHaveBeenCalledWith('ws-1');
    expect(res).toMatchObject({ contentType: 'text/csv' });
    expect(res.fileName).toMatch(/\.csv$/);
  });
});
