import { Test, TestingModule } from '@nestjs/testing';
import type { UserRow } from '@repo/database';

import { UsersService } from '../services/users.service';
import { UsersController } from './users.controller';

const mockUserRow: UserRow = {
  id: 'u1',
  displayName: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'argon2hash',
  avatarUrl: null,
  bio: null,
  timezone: 'America/New_York',
  locale: 'en-US',
  status: 'ACTIVE',
  lastLoginAt: null,
  emailVerifiedAt: new Date(),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn(),
            updateProfile: jest.fn(),
            deleteAccount: jest.fn(),
            listUsers: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('getMe returns the current user profile', async () => {
    usersService.getProfile.mockResolvedValue(mockUserRow);

    const result = await controller.getMe({ id: 'u1' } as never);
    expect(result.id).toBe('u1');
    expect(result.displayName).toBe('Ada');
  });

  it('updateMe updates and returns profile', async () => {
    usersService.updateProfile.mockResolvedValue({
      ...mockUserRow,
      displayName: 'Ada Lovelace',
    });

    const result = await controller.updateMe({ id: 'u1' } as never, {
      displayName: 'Ada Lovelace',
    });
    expect(result.displayName).toBe('Ada Lovelace');
  });

  it('getUserById returns user profile', async () => {
    usersService.getProfile.mockResolvedValue(mockUserRow);

    const result = await controller.getUserById('u1');
    expect(result.id).toBe('u1');
  });

  it('listUsers returns paginated users', async () => {
    usersService.listUsers.mockResolvedValue({
      users: [mockUserRow],
      total: 1,
    });

    const result = await controller.listUsers('10', '0');
    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('deleteUser calls deleteAccount', async () => {
    await controller.deleteUser({ id: 'admin' } as never, 'target-id');
    expect(usersService.deleteAccount).toHaveBeenCalledWith(
      'admin',
      'target-id',
    );
  });
});
