import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE, type UserRow } from '@repo/database';

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
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepo = module.get(UsersRepository);
    events = module.get(UsersEventBus);
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
    it('soft-deletes the target user and publishes event', async () => {
      usersRepo.findById.mockResolvedValue(mockUser);

      await service.deleteAccount('admin-id', 'user-1');

      expect(usersRepo.softDelete).toHaveBeenCalledWith('user-1');
      expect(events.publishUserAccountDeleted).toHaveBeenCalledWith({
        userId: 'user-1',
      });
    });

    it('throws CANNOT_DELETE_SELF when deleting own account', async () => {
      await expect(service.deleteAccount('user-1', 'user-1')).rejects.toThrow(
        'Cannot delete your own account',
      );
    });

    it('throws USER_NOT_FOUND when target does not exist', async () => {
      usersRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.deleteAccount('admin-id', 'missing'),
      ).rejects.toThrow('User not found.');
    });
  });

  describe('listUsers', () => {
    it('returns paginated users with total count', async () => {
      usersRepo.list.mockResolvedValue([mockUser]);
      usersRepo.count.mockResolvedValue(1);

      const result = await service.listUsers({ limit: 10, offset: 0 });

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(usersRepo.list).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(usersRepo.count).toHaveBeenCalled();
    });
  });
});
