import { Test, TestingModule } from '@nestjs/testing';

import { AdminGuard } from '../../auth/guards/admin.guard';
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
  let admin: { impersonate: jest.Mock };

  beforeEach(async () => {
    adminRepo = {
      lookupUsers: jest.fn(),
      findUserById: jest.fn(),
      lookupWorkspaces: jest.fn(),
      findWorkspaceById: jest.fn(),
    };
    admin = { impersonate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: AdminRepository, useValue: adminRepo },
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

  it('GET /users/:id/subscription returns the stub', () => {
    expect(controller.getSubscription()).toEqual(
      AdminService.STUB_SUBSCRIPTION,
    );
  });

  it('POST /users/:id/impersonate calls service.impersonate', async () => {
    admin.impersonate.mockResolvedValue({ token: 'tkn' });
    const currentUser = { id: 'admin-1' } as never;
    const res = await controller.impersonate(currentUser, 'u-2');
    expect(admin.impersonate).toHaveBeenCalledWith('admin-1', 'u-2');
    expect(res).toEqual({ token: 'tkn' });
  });
});
