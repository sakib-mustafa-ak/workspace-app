import { UsersEventBus } from './users.events';

describe('UsersEventBus', () => {
  let bus: UsersEventBus;

  beforeEach(() => {
    bus = new UsersEventBus();
  });

  it('emits and receives UserProfileUpdated', () => {
    const listener = jest.fn();
    bus.onUserProfileUpdated(listener);

    const payload = { userId: 'u1', displayName: 'Ada' };
    bus.publishUserProfileUpdated(payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('emits and receives UserAvatarUpdated', () => {
    const listener = jest.fn();
    bus.onUserAvatarUpdated(listener);

    const payload = { userId: 'u1', avatarUrl: 'https://…' };
    bus.publishUserAvatarUpdated(payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('emits and receives UserAccountDeleted', () => {
    const listener = jest.fn();
    bus.onUserAccountDeleted(listener);

    const payload = { userId: 'u1' };
    bus.publishUserAccountDeleted(payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('supports multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.onUserProfileUpdated(a);
    bus.onUserProfileUpdated(b);

    bus.publishUserProfileUpdated({ userId: 'u1' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
