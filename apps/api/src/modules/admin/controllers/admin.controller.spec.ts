import { Test, TestingModule } from '@nestjs/testing';

import { AdminGuard } from '../../auth/guards/admin.guard';
import { BillingRepository } from '../../billing/data/billing.repository';
import { AdminRepository } from '../data/admin.repository';
import { AdminService } from '../services/admin.service';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  let controller: AdminController;
  let adminRepo: {
    lookupUsers: jest.Mock;
    findUserById: jest.Mock;
    lookupWorkspaces: jest.Mock;
    findWorkspaceById: jest.Mock;
  };
  let admin: { impersonate: jest.Mock; listAudit: jest.Mock };
  const billingRepo = { findByWorkspace: jest.fn() };

  beforeEach(async () => {
    adminRepo = {
      lookupUsers: jest.fn(),
      findUserById: jest.fn(),
      lookupWorkspaces: jest.fn(),
      findWorkspaceById: jest.fn(),
    };
    admin = { impersonate: jest.fn(), listAudit: jest.fn() };
    billingRepo.findByWorkspace.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: AdminRepository, useValue: adminRepo },
        { provide: BillingRepository, useValue: billingRepo },
        { provide: AdminGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get(AdminController);
  });

  it('GET /users returns lookupUsers output', async () => {
    adminRepo.lookupUsers.mockResolvedValue([{ id: 'u-1' }]);
    const res = await controller.getUsers('ada');
    expect(adminRepo.lookupUsers).toHaveBeenCalledWith('ada', 20);
    expect(res).toEqual([{ id: 'u-1' }]);
  });

  it('GET /users/:id returns findUserById output', async () => {
    adminRepo.findUserById.mockResolvedValue({ id: 'u-1' });
    const res = await controller.getUserById('u-1');
    expect(adminRepo.findUserById).toHaveBeenCalledWith('u-1');
    expect(res).toEqual({ id: 'u-1' });
  });

  it('GET /workspaces returns lookupWorkspaces output', async () => {
    adminRepo.lookupWorkspaces.mockResolvedValue([{ id: 'ws-1' }]);
    const res = await controller.getWorkspaces('acme');
    expect(adminRepo.lookupWorkspaces).toHaveBeenCalledWith('acme', 20);
    expect(res).toEqual([{ id: 'ws-1' }]);
  });

  it('GET /workspaces/:id returns findWorkspaceById output', async () => {
    adminRepo.findWorkspaceById.mockResolvedValue({ id: 'ws-1' });
    const res = await controller.getWorkspaceById('ws-1');
    expect(adminRepo.findWorkspaceById).toHaveBeenCalledWith('ws-1');
    expect(res).toEqual({ id: 'ws-1' });
  });

  it('GET /workspaces/:id/subscription returns the stored plan', async () => {
    billingRepo.findByWorkspace.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
    });
    const res = await controller.getWorkspaceSubscription('ws-1');
    expect(billingRepo.findByWorkspace).toHaveBeenCalledWith('ws-1');
    expect(res).toEqual({ plan: 'PRO', status: 'ACTIVE' });
  });

  it('GET /workspaces/:id/subscription defaults to FREE when no row exists', async () => {
    billingRepo.findByWorkspace.mockResolvedValue(undefined);
    const res = await controller.getWorkspaceSubscription('legacy-1');
    expect(res).toEqual({ plan: 'FREE', status: 'ACTIVE' });
  });

  it('POST /users/:id/impersonate calls service.impersonate', async () => {
    admin.impersonate.mockResolvedValue({ token: 'tkn' });
    const currentUser = { id: 'admin-1' } as never;
    const res = await controller.impersonate(currentUser, 'u-2');
    expect(admin.impersonate).toHaveBeenCalledWith('admin-1', 'u-2');
    expect(res).toEqual({ token: 'tkn' });
  });

  it('GET /audit passes filters to service.listAudit and returns rows', async () => {
    admin.listAudit.mockResolvedValue([{ id: 'aud-1' }]);
    const res = await controller.getAudit(
      'u-1',
      'user.impersonated',
      '2026-01-01T00:00:00.000Z',
      undefined,
    );
    expect(admin.listAudit).toHaveBeenCalledWith({
      actorId: 'u-1',
      action: 'user.impersonated',
      from: '2026-01-01T00:00:00.000Z',
      to: undefined,
    });
    expect(res).toEqual([{ id: 'aud-1' }]);
  });
});
