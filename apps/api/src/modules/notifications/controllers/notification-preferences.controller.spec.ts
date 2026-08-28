import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from '../services/notification-preferences.service';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let service: { getAll: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    service = { getAll: jest.fn(), upsert: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
      ],
    }).compile();
    controller = module.get(NotificationPreferencesController);
  });

  it('GET returns preferences for the calling user', async () => {
    service.getAll.mockResolvedValue([
      { type: 'COMMENT_ADDED', emailEnabled: true, inAppEnabled: true },
    ]);
    const currentUser = { id: 'u-1' } as never;
    const res = await controller.get(currentUser);
    expect(service.getAll).toHaveBeenCalledWith('u-1');
    expect(res.preferences).toHaveLength(1);
  });

  it('PUT upserts only well-formed entries, then returns merged prefs', async () => {
    service.upsert.mockResolvedValue(undefined);
    service.getAll.mockResolvedValue([
      { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: true },
    ]);
    const currentUser = { id: 'u-1' } as never;
    const res = await controller.update(currentUser, {
      preferences: [
        { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: true },
        { type: 'BOGUS' },
      ],
    });
    expect(service.upsert).toHaveBeenCalledWith('u-1', [
      { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: true },
    ]);
    expect(service.getAll).toHaveBeenCalledWith('u-1');
    expect(res.preferences).toHaveLength(1);
  });

  it('PUT tolerates an undefined body', async () => {
    service.getAll.mockResolvedValue([]);
    const currentUser = { id: 'u-1' } as never;
    await expect(
      controller.update(currentUser, undefined as never),
    ).resolves.toEqual({ preferences: [] });
    expect(service.upsert).toHaveBeenCalledWith('u-1', []);
  });
});
