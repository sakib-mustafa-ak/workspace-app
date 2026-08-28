import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesRepository } from '../repositories/notification-preferences.repository';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let repo: {
    listByUser: jest.Mock;
    findByUserAndType: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      listByUser: jest.fn(),
      findByUserAndType: jest.fn(),
      upsert: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: NotificationPreferencesRepository, useValue: repo },
      ],
    }).compile();
    service = module.get(NotificationPreferencesService);
  });

  it('returns all notification types, defaulting missing rows to enabled', async () => {
    repo.listByUser.mockResolvedValue([
      {
        userId: 'u-1',
        type: 'TASK_ASSIGNED',
        emailEnabled: false,
        inAppEnabled: true,
      },
    ]);
    const all = await service.getAll('u-1');
    expect(all).toHaveLength(10);
    const assigned = all.find((p) => p.type === 'TASK_ASSIGNED');
    expect(assigned).toEqual({
      type: 'TASK_ASSIGNED',
      emailEnabled: false,
      inAppEnabled: true,
    });
    const comment = all.find((p) => p.type === 'COMMENT_ADDED');
    expect(comment).toEqual({
      type: 'COMMENT_ADDED',
      emailEnabled: true,
      inAppEnabled: true,
    });
  });

  it('isEmailEnabled uses the stored row when present and defaults to true otherwise', async () => {
    repo.findByUserAndType.mockResolvedValue({ emailEnabled: false });
    await expect(service.isEmailEnabled('u-1', 'TASK_ASSIGNED')).resolves.toBe(
      false,
    );
    repo.findByUserAndType.mockResolvedValue(undefined);
    await expect(service.isEmailEnabled('u-1', 'TASK_ASSIGNED')).resolves.toBe(
      true,
    );
  });

  it('upsert filters unknown types', async () => {
    await service.upsert('u-1', [
      {
        type: 'TASK_ASSIGNED' as never,
        emailEnabled: true,
        inAppEnabled: false,
      },
      { type: 'NOT_A_TYPE' as never, emailEnabled: true, inAppEnabled: true },
    ]);
    expect(repo.upsert).toHaveBeenCalledWith('u-1', [
      { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: false },
    ]);
  });
});
