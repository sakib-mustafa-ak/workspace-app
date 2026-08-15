import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE, type UserRow } from '@repo/database';

import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { UsersEventBus } from '../events/users.events';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from './users.service';

const mockDb = {};
const mockUser: UserRow = {
  id: 'user-1',
  displayName: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'argon2hash',
  avatarUrl: null,
  bio: null,
  timezone: null,
  locale: null,
  status: 'ACTIVE',
  lastLoginAt: null,
  emailVerifiedAt: new Date(),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSuspendedUser: UserRow = {
  ...mockUser,
  id: 'user-2',
  status: 'SUSPENDED',
};

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: jest.Mocked<UsersRepository>;
  let events: jest.Mocked<UsersEventBus>;
  let membersRepo: jest.Mocked<WorkspaceMembersRepository>;
  let auditRepo: jest.Mocked<AuditRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DATABASE, useValue: mockDb },
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            updateProfile: jest.fn(),
            softDelete: jest.fn(),
            list: jest.fn(),
            count: jest.fn(),
            countFiltered: jest.fn(),
          },
        },
        {
          provide: UsersEventBus,
          useValue: {
            publishUserProfileUpdated: jest.fn(),
            publishUserAvatarUpdated: jest.fn(),
            publishUserAccountDeleted: jest.fn(),
          },
        },
        {
          provide: WorkspaceMembersRepository,
          useValue: {
            listByUserWithWorkspace: jest.fn(),
          },
        },
        {
          provide: AuditRepository,
          useValue: {
            listByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepo = module.get(UsersRepository);
    events = module.get(UsersEventBus);
    membersRepo = module.get(WorkspaceMembersRepository);
    auditRepo = module.get(AuditRepository);
  });

  describe('getProfile', () => {
    it('returns the user when found', async () => {
      usersRepo.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');
      expect(result).toEqual(mockUser);
      expect(usersRepo.findById).toHaveBeenCalledWith('user-1');
    });

    it('throws USER_NOT_FOUND when user does not exist', async () => {
      usersRepo.findById.mockResolvedValue(undefined);

      await expect(service.getProfile('missing')).rejects.toThrow(
        'User not found.',
      );
    });
  });

  describe('updateProfile', () => {
    it('updates and returns the user', async () => {
      usersRepo.findById.mockResolvedValue(mockUser);
      usersRepo.updateProfile.mockResolvedValue({
        ...mockUser,
        displayName: 'Ada Lovelace',
      });

      const result = await service.updateProfile('user-1', {
        displayName: 'Ada Lovelace',
      });

      expect(result.displayName).toBe('Ada Lovelace');
      expect(usersRepo.updateProfile).toHaveBeenCalledWith('user-1', {
        displayName: 'Ada Lovelace',
      });
      expect(events.publishUserProfileUpdated).toHaveBeenCalledWith({
        userId: 'user-1',
        displayName: 'Ada Lovelace',
      });
    });

    it('throws USER_NOT_FOUND when user is missing', async () => {
      usersRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.updateProfile('missing', { displayName: 'X' }),
      ).rejects.toThrow('User not found.');
    });

    it('throws ACCOUNT_SUSPENDED for suspended users', async () => {
      usersRepo.findById.mockResolvedValue(mockSuspendedUser);

      await expect(
        service.updateProfile('user-2', { displayName: 'X' }),
      ).rejects.toThrow('Account is suspended.');
    });
  });

  describe('deleteAccount', () => {
    it('soft-deletes own account and publishes event', async () => {
      usersRepo.findById.mockResolvedValue(mockUser);

      await service.deleteAccount('user-1', 'user-1');

      expect(usersRepo.softDelete).toHaveBeenCalledWith('user-1');
      expect(events.publishUserAccountDeleted).toHaveBeenCalledWith({
        userId: 'user-1',
      });
    });

    it('throws CANNOT_DELETE_OTHER when deleting another user', async () => {
      await expect(service.deleteAccount('admin-id', 'user-1')).rejects.toThrow(
        'You can only delete your own account.',
      );
      expect(usersRepo.softDelete).not.toHaveBeenCalled();
    });

    it('throws USER_NOT_FOUND when target does not exist', async () => {
      usersRepo.findById.mockResolvedValue(undefined);

      await expect(service.deleteAccount('user-1', 'user-1')).rejects.toThrow(
        'User not found.',
      );
    });
  });

  describe('listUsers', () => {
    it('returns paginated users with total count', async () => {
      usersRepo.list.mockResolvedValue([mockUser]);
      usersRepo.countFiltered.mockResolvedValue(1);

      const result = await service.listUsers({ limit: 10, offset: 0 });

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(usersRepo.list).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(usersRepo.countFiltered).toHaveBeenCalledWith(undefined);
    });

    it('passes search and sort to the repository', async () => {
      usersRepo.list.mockResolvedValue([]);
      usersRepo.countFiltered.mockResolvedValue(0);

      await service.listUsers({
        limit: 10,
        offset: 0,
        search: 'ada',
        sortBy: 'displayName',
        sortOrder: 'desc',
      });

      expect(usersRepo.list).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        search: 'ada',
        sortBy: 'displayName',
        sortOrder: 'desc',
      });
      expect(usersRepo.countFiltered).toHaveBeenCalledWith('ada');
    });
  });

  describe('getUserMemberships', () => {
    it('returns memberships with workspace names', async () => {
      membersRepo.listByUserWithWorkspace.mockResolvedValue([
        {
          workspaceId: 'w1',
          workspaceName: 'Acme',
          role: 'EDITOR',
          joinedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const result = await service.getUserMemberships('user-1');

      expect(result).toEqual([
        {
          workspaceId: 'w1',
          workspaceName: 'Acme',
          role: 'EDITOR',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('getUserActivity', () => {
    it('returns mapped audit events', async () => {
      auditRepo.listByUser.mockResolvedValue([
        {
          id: 'a1',
          workspaceId: 'w1',
          userId: 'user-1',
          action: 'board.created',
          resourceType: 'board',
          resourceId: 'b1',
          metadata: { note: 'x' },
          createdAt: new Date('2026-01-02T00:00:00Z'),
        },
      ]);

      const result = await service.getUserActivity('user-1');

      expect(result).toEqual([
        {
          id: 'a1',
          action: 'board.created',
          entityType: 'board',
          entityId: 'b1',
          metadata: { note: 'x' },
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ]);
      expect(auditRepo.listByUser).toHaveBeenCalledWith('user-1', 20);
    });
  });
});
