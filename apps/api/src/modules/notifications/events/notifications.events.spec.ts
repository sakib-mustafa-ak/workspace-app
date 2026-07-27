import { NotificationsEventBus } from './notifications.events';

describe('NotificationsEventBus', () => {
  let bus: NotificationsEventBus;

  beforeEach(() => {
    bus = new NotificationsEventBus();
  });

  it('emits NotificationCreated', () => {
    const fn = jest.fn();
    bus.onNotificationCreated(fn);
    const payload = {
      notificationId: 'n1',
      userId: 'u1',
      type: 'COMMENT_ADDED',
    };
    bus.publishNotificationCreated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });

  it('supports multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.onNotificationCreated(a);
    bus.onNotificationCreated(b);

    bus.publishNotificationCreated({
      notificationId: 'n1',
      userId: 'u1',
      type: 'COMMENT_ADDED',
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
