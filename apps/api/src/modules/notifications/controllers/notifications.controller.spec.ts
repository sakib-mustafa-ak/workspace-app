import { Test, TestingModule } from '@nestjs/testing';
import type { NotificationRow } from '@repo/database';

import { NotificationsService } from '../services/notifications.service';
import { NotificationsController } from './notifications.controller';

const mockNotification: NotificationRow = {
  id: 'n1',
  userId: 'u1',
  type: 'COMMENT_ADDED',
  channel: 'IN_APP',
  status: 'DELIVERED',
  title: 'New comment',
  body: null,
  resourceType: null,
  resourceId: null,
  readAt: null,
  deliveredAt: new Date(),
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            list: jest.fn(),
            getById: jest.fn(),
            countUnread: jest.fn(),
            totalCount: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            archive: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get(NotificationsService);
  });

  const currentUser = { id: 'u1', email: 'test@test.com' };

  describe('list', () => {
    it('lists notifications', async () => {
      service.list.mockResolvedValue([mockNotification]);
      service.totalCount.mockResolvedValue(1);

      const result = await controller.list(
        currentUser as never,
        undefined,
        undefined,
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('countUnread', () => {
    it('returns count', async () => {
      service.countUnread.mockResolvedValue({ count: 3 });

      const result = await controller.countUnread(currentUser as never);

      expect(result.count).toBe(3);
    });
  });

  describe('getById', () => {
    it('returns a notification', async () => {
      service.getById.mockResolvedValue(mockNotification);

      const result = await controller.getById(currentUser as never, 'n1');

      expect(result.id).toBe('n1');
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      service.markAsRead.mockResolvedValue({
        ...mockNotification,
        status: 'READ',
        readAt: new Date(),
      });

      const result = await controller.markAsRead(currentUser as never, 'n1');

      expect(result.status).toBe('READ');
    });
  });

  describe('markAllAsRead', () => {
    it('marks all as read', async () => {
      await controller.markAllAsRead(currentUser as never);
      expect(service.markAllAsRead).toHaveBeenCalledWith('u1');
    });
  });

  describe('archive', () => {
    it('archives notification', async () => {
      await controller.archive(currentUser as never, 'n1');
      expect(service.archive).toHaveBeenCalledWith('n1', 'u1');
    });
  });
});
