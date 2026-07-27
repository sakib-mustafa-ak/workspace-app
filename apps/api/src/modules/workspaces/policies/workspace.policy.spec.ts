import { WorkspacePolicy } from './workspace.policy';

describe('WorkspacePolicy', () => {
  let policy: WorkspacePolicy;

  beforeEach(() => {
    policy = new WorkspacePolicy();
  });

  describe('isAtLeast', () => {
    it('VIEWER is at least VIEWER', () => {
      expect(policy.isAtLeast('VIEWER', 'VIEWER')).toBe(true);
    });

    it('EDITOR is at least VIEWER', () => {
      expect(policy.isAtLeast('EDITOR', 'VIEWER')).toBe(true);
    });

    it('ADMIN is at least EDITOR', () => {
      expect(policy.isAtLeast('ADMIN', 'EDITOR')).toBe(true);
    });

    it('OWNER is at least ADMIN', () => {
      expect(policy.isAtLeast('OWNER', 'ADMIN')).toBe(true);
    });

    it('VIEWER is not at least EDITOR', () => {
      expect(policy.isAtLeast('VIEWER', 'EDITOR')).toBe(false);
    });

    it('EDITOR is not at least ADMIN', () => {
      expect(policy.isAtLeast('EDITOR', 'ADMIN')).toBe(false);
    });
  });

  describe('canManage', () => {
    it('ADMIN can manage', () => expect(policy.canManage('ADMIN')).toBe(true));
    it('OWNER can manage', () => expect(policy.canManage('OWNER')).toBe(true));
    it('VIEWER cannot manage', () =>
      expect(policy.canManage('VIEWER')).toBe(false));
    it('EDITOR cannot manage', () =>
      expect(policy.canManage('EDITOR')).toBe(false));
  });

  describe('canEdit', () => {
    it('EDITOR can edit', () => expect(policy.canEdit('EDITOR')).toBe(true));
    it('ADMIN can edit', () => expect(policy.canEdit('ADMIN')).toBe(true));
    it('VIEWER cannot edit', () =>
      expect(policy.canEdit('VIEWER')).toBe(false));
  });

  describe('canInvite', () => {
    it('ADMIN can invite', () => expect(policy.canInvite('ADMIN')).toBe(true));
    it('VIEWER cannot invite', () =>
      expect(policy.canInvite('VIEWER')).toBe(false));
  });

  describe('canTransferOwnership', () => {
    it('OWNER can transfer ownership', () =>
      expect(policy.canTransferOwnership('OWNER')).toBe(true));
    it('ADMIN cannot transfer ownership', () =>
      expect(policy.canTransferOwnership('ADMIN')).toBe(false));
  });

  describe('rank', () => {
    it('returns numeric rank', () => {
      expect(policy.rank('VIEWER')).toBe(0);
      expect(policy.rank('EDITOR')).toBe(1);
      expect(policy.rank('ADMIN')).toBe(2);
      expect(policy.rank('OWNER')).toBe(3);
    });
  });
});
