import { Test, TestingModule } from '@nestjs/testing';
import type { WorkspaceRow, InvitationRow } from '@repo/database';

import type { WorkspaceMemberWithUser } from '../repositories/workspace-members.repository';
import { WorkspacesService } from '../services/workspaces.service';
import { WorkspacesController } from './workspaces.controller';

const mockWorkspace: WorkspaceRow = {
  id: 'w1',
  name: 'Test',
  slug: 'test',
  ownerId: 'u1',
  status: 'ACTIVE',
  description: null,
  logoUrl: null,
  website: null,
  settings: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockMember: WorkspaceMemberWithUser = {
  id: 'm1',
  workspaceId: 'w1',
  userId: 'u2',
  role: 'EDITOR',
  status: 'ACTIVE',
  joinedAt: new Date(),
  deletedAt: null,
  invitationId: null,
  user: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvitation: InvitationRow = {
  id: 'inv1',
  workspaceId: 'w1',
  email: 'a@b.com',
  inviteeId: null,
  role: 'EDITOR',
  status: 'PENDING',
  selector: 'sel1',
  verifierHash: 'hash',
  invitedById: 'u1',
  acceptedById: null,
  acceptedAt: null,
  revokedAt: null,
  expiresAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: jest.Mocked<WorkspacesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            create: jest.fn(),
            listByUserWithStats: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            unarchive: jest.fn(),
            delete: jest.fn(),
            getMembers: jest.fn(),
            changeMemberRole: jest.fn(),
            removeMember: jest.fn(),
            createInvitation: jest.fn(),
            getInvitations: jest.fn(),
            revokeInvitation: jest.fn(),
            acceptInvitation: jest.fn(),
            getMembership: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    service = module.get(WorkspacesService);
  });

  it('create returns workspace response', async () => {
    service.create.mockResolvedValue(mockWorkspace);

    const result = await controller.create({ id: 'u1' } as never, {
      name: 'Test',
      slug: 'test',
    });
    expect(result.id).toBe('w1');
    expect(result.name).toBe('Test');
  });

  it('listMyWorkspaces returns array', async () => {
    service.listByUserWithStats.mockResolvedValue([
      { ...mockWorkspace, memberCount: 1, boardCount: 1 },
    ]);

    const result = await controller.listMyWorkspaces({ id: 'u1' } as never);
    expect(result).toHaveLength(1);
  });

  it('getById returns workspace', async () => {
    service.getById.mockResolvedValue(mockWorkspace);

    const result = await controller.getById('w1');
    expect(result.id).toBe('w1');
  });

  it('update returns updated workspace', async () => {
    service.update.mockResolvedValue({ ...mockWorkspace, name: 'Updated' });

    const result = await controller.update({ id: 'u1' } as never, 'w1', {
      name: 'Updated',
    });
    expect(result.name).toBe('Updated');
  });

  it('archive calls service', async () => {
    await controller.archive({ id: 'u1' } as never, 'w1');
    expect(service.archive).toHaveBeenCalledWith('w1', 'u1');
  });

  it('unarchive calls service', async () => {
    await controller.unarchive({ id: 'u1' } as never, 'w1');
    expect(service.unarchive).toHaveBeenCalledWith('w1', 'u1');
  });

  it('delete calls service', async () => {
    await controller.delete({ id: 'u1' } as never, 'w1');
    expect(service.delete).toHaveBeenCalledWith('w1', 'u1');
  });

  it('getMembers returns member list', async () => {
    service.getMembers.mockResolvedValue([mockMember]);

    const result = await controller.getMembers('w1');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('EDITOR');
  });

  it('changeRole returns updated member', async () => {
    service.changeMemberRole.mockResolvedValue({
      ...mockMember,
      role: 'ADMIN',
    });

    const result = await controller.changeRole(
      { id: 'u1' } as never,
      'w1',
      'u2',
      { role: 'ADMIN' },
    );
    expect(result.role).toBe('ADMIN');
  });

  it('removeMember calls service', async () => {
    await controller.removeMember({ id: 'u1' } as never, 'w1', 'u2');
    expect(service.removeMember).toHaveBeenCalledWith('w1', 'u1', 'u2');
  });

  it('createInvitation returns token', async () => {
    service.createInvitation.mockResolvedValue({
      selector: 'sel1',
      verifier: 'ver1',
    });

    const result = await controller.createInvitation(
      { id: 'u1' } as never,
      'w1',
      { email: 'a@b.com', role: 'EDITOR' },
    );
    expect(result.token).toBe('sel1:ver1');
    expect(result.selector).toBe('sel1');
  });

  it('getInvitations returns invitation list', async () => {
    service.getInvitations.mockResolvedValue([mockInvitation]);

    const result = await controller.getInvitations({ id: 'u1' } as never, 'w1');
    expect(result).toHaveLength(1);
  });

  it('revokeInvitation calls service', async () => {
    await controller.revokeInvitation({ id: 'u1' } as never, 'w1', 'inv1');
    expect(service.revokeInvitation).toHaveBeenCalledWith('w1', 'inv1', 'u1');
  });

  it('acceptInvitation returns workspaceId', async () => {
    service.acceptInvitation.mockResolvedValue({ workspaceId: 'w1' });

    const result = await controller.acceptInvitation({ id: 'u3' } as never, {
      selector: 'sel1',
      verifier: 'ver1',
    });
    expect(result.workspaceId).toBe('w1');
  });
});
