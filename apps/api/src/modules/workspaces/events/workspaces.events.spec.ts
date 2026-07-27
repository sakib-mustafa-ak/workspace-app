import { WorkspacesEventBus } from './workspaces.events';

describe('WorkspacesEventBus', () => {
  let bus: WorkspacesEventBus;

  beforeEach(() => {
    bus = new WorkspacesEventBus();
  });

  it('emits WorkspaceCreated', () => {
    const fn = jest.fn();
    bus.onWorkspaceCreated(fn);
    const payload = { workspaceId: 'w1', ownerId: 'u1' };
    bus.publishWorkspaceCreated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });

  it('emits MemberAdded', () => {
    const fn = jest.fn();
    bus.onWorkspaceCreated(fn);
    bus.publishWorkspaceCreated({ workspaceId: 'w1', ownerId: 'u1' });
    expect(fn).toHaveBeenCalled();
  });

  it('emits InvitationCreated', () => {
    const fn = jest.fn();
    bus.onWorkspaceCreated(fn);
    bus.publishWorkspaceCreated({ workspaceId: 'w1', ownerId: 'u1' });
    expect(fn).toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.onWorkspaceCreated(a);
    bus.onWorkspaceCreated(b);

    bus.publishWorkspaceCreated({ workspaceId: 'w1', ownerId: 'u1' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
