import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';

import {
  DATABASE,
  type WorkspaceRow,
  type InvitationRow,
} from '@repo/database';

import { WorkspacePolicy } from '../policies/workspace.policy';
import { WorkspacesRepository } from '../repositories/workspaces.repository';
import {
  WorkspaceMembersRepository,
  type WorkspaceMemberWithUser,
} from '../repositories/workspace-members.repository';
import { InvitationsRepository } from '../repositories/invitations.repository';
import { WorkspacesEventBus } from '../events/workspaces.events';
import { WorkspacesService } from './workspaces.service';

const mockWorkspace: WorkspaceRow = {
  id: 'w1',
  name: 'Test Workspace',
  slug: 'test-workspace',
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

const mockOwnership: WorkspaceMemberWithUser = {
  id: 'm1',
  workspaceId: 'w1',
  userId: 'u1',
  role: 'OWNER',
  status: 'ACTIVE',
  joinedAt: new Date(),
  deletedAt: null,
  invitationId: null,
  user: { displayName: 'Owner', email: 'owner@example.com' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMemberEntry: WorkspaceMemberWithUser = {
  id: 'm2',
  workspaceId: 'w1',
  userId: 'u2',
  role: 'EDITOR',
  status: 'ACTIVE',
  joinedAt: new Date(),
  deletedAt: null,
  invitationId: null,
  user: { displayName: 'Editor', email: 'editor@example.com' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let workspacesRepo: jest.Mocked<WorkspacesRepository>;
  let members: jest.Mocked<WorkspaceMembersRepository>;
  let invitationsRepo: jest.Mocked<InvitationsRepository>;
  let policy: jest.Mocked<WorkspacePolicy>;
  let events: jest.Mocked<WorkspacesEventBus>;
  let db: { transaction: jest.Mock };

  beforeEach(async () => {
    db = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: DATABASE, useValue: db },
        {
          provide: WorkspacesRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findBySlug: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            unarchive: jest.fn(),
            softDelete: jest.fn(),
            listByUser: jest.fn(),
          },
        },
        {
          provide: WorkspaceMembersRepository,
          useValue: {
            add: jest.fn(),
            findByWorkspaceAndUser: jest.fn(),
            findById: jest.fn(),
            listByWorkspace: jest.fn(),
            updateRole: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: InvitationsRepository,
          useValue: {
            create: jest.fn(),
            findBySelector: jest.fn(),
            listByWorkspace: jest.fn(),
            findPendingByEmail: jest.fn(),
            accept: jest.fn(),
            revoke: jest.fn(),
            expireStale: jest.fn(),
            countPendingByWorkspace: jest.fn(),
          },
        },
        {
          provide: WorkspacePolicy,
          useValue: {
            canManage: jest.fn(),
            canEdit: jest.fn(),
            canInvite: jest.fn(),
            canRemoveMembers: jest.fn(),
            canTransferOwnership: jest.fn(),
            isAtLeast: jest.fn(),
            rank: jest.fn(),
          },
        },
        {
          provide: WorkspacesEventBus,
          useValue: {
            publishWorkspaceCreated: jest.fn(),
            publishWorkspaceUpdated: jest.fn(),
            publishWorkspaceArchived: jest.fn(),
            publishWorkspaceDeleted: jest.fn(),
            publishMemberAdded: jest.fn(),
            publishMemberRoleChanged: jest.fn(),
            publishMemberRemoved: jest.fn(),
            publishInvitationCreated: jest.fn(),
            publishInvitationAccepted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
    workspacesRepo = module.get(WorkspacesRepository);
    members = module.get(WorkspaceMembersRepository);
    invitationsRepo = module.get(InvitationsRepository);
    policy = module.get(WorkspacePolicy);
    events = module.get(WorkspacesEventBus);
  });

  describe('create', () => {
    it('creates a workspace with owner membership via transaction', async () => {
      workspacesRepo.findBySlug.mockResolvedValue(undefined);
      db.transaction.mockImplementation(
        async (cb: (tx: Record<string, jest.Mock>) => Promise<unknown>) => {
          const tx = {
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([mockWorkspace]),
              }),
            }),
          };
          return cb(tx);
        },
      );

      const result = await service.create('u1', {
        name: 'Test Workspace',
        slug: 'test-workspace',
      });

      expect(result.id).toBe('w1');
      expect(events.publishWorkspaceCreated).toHaveBeenCalledWith({
        workspaceId: 'w1',
        ownerId: 'u1',
      });
    });

    it('throws when slug exists', async () => {
      workspacesRepo.findBySlug.mockResolvedValue(mockWorkspace);

      await expect(
        service.create('u1', { name: 'X', slug: 'test-workspace' }),
      ).rejects.toThrow('already taken');
    });

    it('throws for invalid slug pattern', async () => {
      await expect(
        service.create('u1', { name: 'X', slug: 'UPPERCASE' }),
      ).rejects.toThrow('Slug must be lowercase');
    });
  });

  describe('getById', () => {
    it('returns workspace when found', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);

      const result = await service.getById('w1');
      expect(result.id).toBe('w1');
    });

    it('throws when missing', async () => {
      workspacesRepo.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing')).rejects.toThrow(
        'Workspace not found.',
      );
    });
  });

  describe('update', () => {
    it('updates workspace with ADMIN role', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);
      workspacesRepo.update.mockResolvedValue({
        ...mockWorkspace,
        name: 'Updated',
      });

      const result = await service.update('w1', 'u1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(workspacesRepo.update).toHaveBeenCalledWith('w1', {
        name: 'Updated',
      });
      expect(events.publishWorkspaceUpdated).toHaveBeenCalled();
    });

    it('throws when user has no membership', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);
      members.findByWorkspaceAndUser.mockResolvedValue(undefined);

      await expect(service.update('w1', 'u2', { name: 'X' })).rejects.toThrow(
        'not a member',
      );
    });

    it('throws when viewer tries to update', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);
      members.findByWorkspaceAndUser.mockResolvedValue({
        ...mockMemberEntry,
        role: 'VIEWER',
      });
      policy.isAtLeast.mockReturnValue(false);

      await expect(service.update('w1', 'u2', { name: 'X' })).rejects.toThrow(
        'Requires ADMIN role',
      );
    });

    it('throws when updating to taken slug', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);
      workspacesRepo.findBySlug.mockResolvedValue({
        ...mockWorkspace,
        id: 'w2',
      });

      await expect(
        service.update('w1', 'u1', { slug: 'taken-slug' }),
      ).rejects.toThrow('already taken');
    });
  });

  describe('archive / unarchive / delete', () => {
    it('archives with ADMIN role', async () => {
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);

      await service.archive('w1', 'u1');
      expect(workspacesRepo.archive).toHaveBeenCalledWith('w1');
      expect(events.publishWorkspaceArchived).toHaveBeenCalled();
    });

    it('unarchives with OWNER role', async () => {
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);

      await service.unarchive('w1', 'u1');
      expect(workspacesRepo.unarchive).toHaveBeenCalledWith('w1');
    });

    it('soft-deletes with OWNER role', async () => {
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);

      await service.delete('w1', 'u1');
      expect(workspacesRepo.softDelete).toHaveBeenCalledWith('w1');
      expect(events.publishWorkspaceDeleted).toHaveBeenCalled();
    });

    it('throws when user has no membership', async () => {
      members.findByWorkspaceAndUser.mockResolvedValue(undefined);

      await expect(service.archive('w1', 'u3')).rejects.toThrow('not a member');
      await expect(service.unarchive('w1', 'u3')).rejects.toThrow(
        'not a member',
      );
      await expect(service.delete('w1', 'u3')).rejects.toThrow('not a member');
    });
  });

  describe('getMembers', () => {
    it('returns members for existing workspace when caller is a member', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
      members.listByWorkspace.mockResolvedValue([
        mockOwnership,
        mockMemberEntry,
      ]);

      const result = await service.getMembers('w1', 'u1');
      expect(result).toHaveLength(2);
    });

    it('throws when caller is not a member', async () => {
      workspacesRepo.findById.mockResolvedValue(mockWorkspace);
      members.findByWorkspaceAndUser.mockResolvedValue(undefined);

      await expect(service.getMembers('w1', 'outsider')).rejects.toThrow(
        'not a member',
      );
      expect(members.listByWorkspace).not.toHaveBeenCalled();
    });

    it('throws when workspace missing', async () => {
      workspacesRepo.findById.mockResolvedValue(undefined);

      await expect(service.getMembers('missing', 'u1')).rejects.toThrow(
        'Workspace not found.',
      );
    });
  });

  describe('changeMemberRole', () => {
    it('changes role for non-owner member', async () => {
      members.findByWorkspaceAndUser
        .mockResolvedValueOnce(mockOwnership)
        .mockResolvedValueOnce(mockMemberEntry);
      policy.isAtLeast.mockReturnValue(true);
      members.updateRole.mockResolvedValue({
        ...mockMemberEntry,
        role: 'ADMIN',
      });

      const result = await service.changeMemberRole('w1', 'u1', 'u2', 'ADMIN');
      expect(result.role).toBe('ADMIN');
      expect(events.publishMemberRoleChanged).toHaveBeenCalled();
    });

    it('throws when target is OWNER', async () => {
      members.findByWorkspaceAndUser
        .mockResolvedValueOnce(mockOwnership)
        .mockResolvedValueOnce(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);

      await expect(
        service.changeMemberRole('w1', 'u1', 'u1', 'VIEWER'),
      ).rejects.toThrow('Cannot change the owner role');
    });
  });

  describe('removeMember', () => {
    it('removes non-owner member', async () => {
      members.findByWorkspaceAndUser
        .mockResolvedValueOnce(mockOwnership)
        .mockResolvedValueOnce(mockMemberEntry);
      policy.isAtLeast.mockReturnValue(true);

      await service.removeMember('w1', 'u1', 'u2');
      expect(members.remove).toHaveBeenCalledWith('w1', 'u2');
      expect(events.publishMemberRemoved).toHaveBeenCalled();
    });

    it('throws when target is OWNER', async () => {
      members.findByWorkspaceAndUser
        .mockResolvedValueOnce(mockOwnership)
        .mockResolvedValueOnce(mockOwnership);
      policy.isAtLeast.mockReturnValue(true);

      await expect(service.removeMember('w1', 'u1', 'u1')).rejects.toThrow(
        'Cannot remove the workspace owner',
      );
    });
  });

  describe('invitations', () => {
    const mockInvitation: InvitationRow = {
      id: 'inv1',
      workspaceId: 'w1',
      email: 'new@member.com',
      inviteeId: null,
      role: 'EDITOR',
      status: 'PENDING',
      selector: 'sel1',
      verifierHash: 'abc123',
      invitedById: 'u1',
      acceptedById: null,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('createInvitation', () => {
      it('creates invitation and returns token pair', async () => {
        members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
        policy.isAtLeast.mockReturnValue(true);
        invitationsRepo.countPendingByWorkspace.mockResolvedValue(0);
        invitationsRepo.findPendingByEmail.mockResolvedValue(undefined);
        invitationsRepo.create.mockResolvedValue(mockInvitation);

        const result = await service.createInvitation('w1', 'u1', {
          email: 'new@member.com',
          role: 'EDITOR',
        });

        expect(result.selector).toBeDefined();
        expect(result.verifier).toBeDefined();
        expect(events.publishInvitationCreated).toHaveBeenCalled();
      });

      it('throws when too many pending invitations', async () => {
        members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);
        policy.isAtLeast.mockReturnValue(true);
        invitationsRepo.countPendingByWorkspace.mockResolvedValue(100);

        await expect(
          service.createInvitation('w1', 'u1', {
            email: 'a@b.com',
            role: 'EDITOR',
          }),
        ).rejects.toThrow('Too many pending');
      });
    });

    describe('acceptInvitation', () => {
      it('accepts a valid invitation and creates membership', async () => {
        const invitationWithMatchingHash = {
          ...mockInvitation,
          verifierHash: createHash('sha256')
            .update('sel1verifier')
            .digest('hex'),
        };
        invitationsRepo.findBySelector.mockResolvedValue(
          invitationWithMatchingHash,
        );
        members.findByWorkspaceAndUser.mockResolvedValue(undefined);

        const tx = {
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue(undefined),
          }),
        };
        db.transaction.mockImplementation(
          async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
        );

        const result = await service.acceptInvitation('sel1', 'verifier', 'u3');
        expect(result.workspaceId).toBe('w1');
        expect(events.publishInvitationAccepted).toHaveBeenCalled();
        expect(events.publishMemberAdded).toHaveBeenCalled();
      });

      it('throws when selector is unknown', async () => {
        invitationsRepo.findBySelector.mockResolvedValue(undefined);

        await expect(
          service.acceptInvitation('bad', 'x', 'u3'),
        ).rejects.toThrow('Invitation not found.');
      });

      it('throws when already accepted', async () => {
        const invitationWithMatchingHash = {
          ...mockInvitation,
          status: 'ACCEPTED' as const,
          verifierHash: createHash('sha256')
            .update('sel1verifier')
            .digest('hex'),
        };
        invitationsRepo.findBySelector.mockResolvedValue(
          invitationWithMatchingHash,
        );

        await expect(
          service.acceptInvitation('sel1', 'verifier', 'u3'),
        ).rejects.toThrow('already accepted');
      });

      it('throws when revoked', async () => {
        const invitationWithMatchingHash = {
          ...mockInvitation,
          status: 'REVOKED' as const,
          verifierHash: createHash('sha256')
            .update('sel1verifier')
            .digest('hex'),
        };
        invitationsRepo.findBySelector.mockResolvedValue(
          invitationWithMatchingHash,
        );

        await expect(
          service.acceptInvitation('sel1', 'verifier', 'u3'),
        ).rejects.toThrow('has been revoked');
      });

      it('throws when expired', async () => {
        const invitationWithMatchingHash = {
          ...mockInvitation,
          expiresAt: new Date(500_000_000),
          verifierHash: createHash('sha256')
            .update('sel1verifier')
            .digest('hex'),
        };
        invitationsRepo.findBySelector.mockResolvedValue(
          invitationWithMatchingHash,
        );

        await expect(
          service.acceptInvitation('sel1', 'verifier', 'u3'),
        ).rejects.toThrow('has expired');
      });

      it('throws when user already belongs to workspace', async () => {
        const invitationWithMatchingHash = {
          ...mockInvitation,
          verifierHash: createHash('sha256')
            .update('sel1verifier')
            .digest('hex'),
        };
        invitationsRepo.findBySelector.mockResolvedValue(
          invitationWithMatchingHash,
        );
        members.findByWorkspaceAndUser.mockResolvedValue(mockMemberEntry);

        await expect(
          service.acceptInvitation('sel1', 'verifier', 'u2'),
        ).rejects.toThrow('already a member');
      });
    });
  });

  describe('getMembership', () => {
    it('returns membership when found', async () => {
      members.findByWorkspaceAndUser.mockResolvedValue(mockOwnership);

      const result = await service.getMembership('w1', 'u1');
      expect(result.role).toBe('OWNER');
    });

    it('throws when membership missing', async () => {
      members.findByWorkspaceAndUser.mockResolvedValue(undefined);

      await expect(service.getMembership('w1', 'u3')).rejects.toThrow(
        'not a member',
      );
    });
  });
});
