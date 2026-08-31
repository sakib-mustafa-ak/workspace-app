import { BillingPolicy } from './billing.policy';

describe('BillingPolicy', () => {
  const policy = new BillingPolicy();

  describe('canCreateBoard', () => {
    it('allows on FREE while under 3', () => {
      expect(policy.canCreateBoard('FREE', 0)).toBe(true);
      expect(policy.canCreateBoard('FREE', 2)).toBe(true);
    });
    it('blocks on FREE at the 3-board limit', () => {
      expect(policy.canCreateBoard('FREE', 3)).toBe(false);
      expect(policy.canCreateBoard('FREE', 9)).toBe(false);
    });
    it('is unlimited on PRO and TEAM', () => {
      expect(policy.canCreateBoard('PRO', 100)).toBe(true);
      expect(policy.canCreateBoard('TEAM', 1000)).toBe(true);
    });
  });

  describe('canAddMember', () => {
    it('blocks on FREE at 3 active seats', () => {
      expect(policy.canAddMember('FREE', 3)).toBe(false);
      expect(policy.canAddMember('FREE', 2)).toBe(true);
    });
    it('is unlimited on paid plans', () => {
      expect(policy.canAddMember('PRO', 300)).toBe(true);
    });
  });

  describe('canOwnWorkspace', () => {
    it('allows owning exactly 1 workspace on FREE', () => {
      expect(policy.canOwnWorkspace('FREE', 1)).toBe(false);
      expect(policy.canOwnWorkspace('FREE', 0)).toBe(true);
    });
    it('is unlimited on paid plans', () => {
      expect(policy.canOwnWorkspace('PRO', 20)).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('gates AUDIT_LOG_EXPORT to TEAM', () => {
      expect(policy.hasFeature('FREE', 'AUDIT_LOG_EXPORT')).toBe(false);
      expect(policy.hasFeature('PRO', 'AUDIT_LOG_EXPORT')).toBe(false);
      expect(policy.hasFeature('TEAM', 'AUDIT_LOG_EXPORT')).toBe(true);
    });
    it('exposes SSO and ADMIN_TOOLS flags on TEAM', () => {
      expect(policy.hasFeature('TEAM', 'SSO')).toBe(true);
      expect(policy.hasFeature('TEAM', 'ADMIN_TOOLS')).toBe(true);
    });
  });

  describe('highestPlan', () => {
    it('returns the highest plan in a list', () => {
      expect(policy.highestPlan(['FREE', 'PRO'])).toBe('PRO');
      expect(policy.highestPlan(['PRO', 'TEAM', 'FREE'])).toBe('TEAM');
      expect(policy.highestPlan(['FREE'])).toBe('FREE');
    });
  });
});
