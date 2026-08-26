import { Test, TestingModule } from '@nestjs/testing';
import type { NotificationRow } from '@repo/database';

import { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsEventBus } from '../events/notifications.events';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { NotificationsService } from './notifications.service';

const mockNotification: NotificationRow = {
  id: 'n1',
  userId: 'u1',
  type: 'COMMENT_ADDED',
  channel: 'IN_APP',
  status: 'DELIVERED',
  title: 'New comment on Sprint 24',
  body: 'u2 commented: Great work!',
  resourceType: 'board',
  resourceId: 'b1',
  readAt: null,
  deliveredAt: new Date(),
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCreatedNotification: NotificationRow = {
  ...mockNotification,
  status: 'CREATED',
  deliveredAt: null,
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<NotificationsRepository>;
  let events: jest.Mocked<NotificationsEventBus>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NotificationsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            listByUser: jest.fn(),
            countUnread: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            archive: jest.fn(),
            deliver: jest.fn(),
          },
        },
        {
          provide: NotificationsEventBus,
          useValue: {
            publishNotificationCreated: jest.fn(),
          },
        },
        {
          provide: PushSubscriptionsService,
          useValue: {
            sendToUser: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repo = module.get(NotificationsRepository);
    events = module.get(NotificationsEventBus);
  });

  describe('create', () => {
    it('creates a notification', async () => {
      repo.create.mockResolvedValue(mockCreatedNotification);

      const result = await service.create('u1', {
        type: 'COMMENT_ADDED',
        title: 'New comment',
        body: 'u2 commented',
        resourceType: 'board',
        resourceId: 'b1',
      });

      expect(result.id).toBe('n1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: 'COMMENT_ADDED',
          status: 'CREATED',
          channel: 'IN_APP',
        }),
      );
      expect(events.publishNotificationCreated).toHaveBeenCalled();
    });
  });

  describe('createAndDeliver', () => {
    it('creates and delivers a notification', async () => {
      repo.create.mockResolvedValue(mockCreatedNotification);

      const result = await service.createAndDeliver('u1', {
        type: 'COMMENT_ADDED',
        title: 'New comment',
      });

      expect(result.id).toBe('n1');
      expect(repo.deliver).toHaveBeenCalledWith('n1');
    });
  });

  describe('list', () => {
    it('lists notifications for user', async () => {
      repo.listByUser.mockResolvedValue([mockNotification]);

      const result = await service.list('u1');

      expect(result).toHaveLength(1);
      expect(repo.listByUser).toHaveBeenCalledWith('u1', undefined);
    });
  });

  describe('countUnread', () => {
    it('returns unread count', async () => {
      repo.countUnread.mockResolvedValue(3);

      const result = await service.countUnread('u1');

      expect(result.count).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      repo.findById.mockResolvedValue(mockNotification);
      repo.markAsRead.mockResolvedValue({
        ...mockNotification,
        status: 'READ',
        readAt: new Date(),
      });

      const result = await service.markAsRead('n1', 'u1');

      expect(result.status).toBe('READ');
    });

    it('throws when notification not found', async () => {
      repo.findById.mockResolvedValue(undefined);

      await expect(service.markAsRead('missing', 'u1')).rejects.toThrow(
        'Notification not found',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marks all as read', async () => {
      await service.markAllAsRead('u1');
      expect(repo.markAllAsRead).toHaveBeenCalledWith('u1');
    });
  });

  describe('archive', () => {
    it('archives a notification', async () => {
      repo.findById.mockResolvedValue(mockNotification);

      await service.archive('n1', 'u1');
      expect(repo.archive).toHaveBeenCalledWith('n1', 'u1');
    });

    it('throws when not found', async () => {
      repo.findById.mockResolvedValue(undefined);

      await expect(service.archive('missing', 'u1')).rejects.toThrow(
        'Notification not found',
      );
    });
  });
});
