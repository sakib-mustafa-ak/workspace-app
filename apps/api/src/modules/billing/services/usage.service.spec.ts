import { type WorkspaceSubscriptionRow } from '@repo/database';

import { BillingRepository } from '../data/billing.repository';
import { UsageRepository } from '../data/usage.repository';
import { BillingPolicy } from '../policies/billing.policy';
import { UsageService } from './usage.service';

function freeRow(workspaceId: string): WorkspaceSubscriptionRow {
  return {
    id: 'sub-1',
    workspaceId,
    plan: 'FREE',
    status: 'ACTIVE',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('UsageService', () => {
  let subs: { findByWorkspace: jest.Mock; findPlansByOwner: jest.Mock };
  let usage: {
    countActiveSeats: jest.Mock;
    countBoards: jest.Mock;
    countOwnedWorkspaces: jest.Mock;
    findActiveMemberRole: jest.Mock;
    findOwnerId: jest.Mock;
  };
  let service: UsageService;

  beforeEach(() => {
    subs = { findByWorkspace: jest.fn(), findPlansByOwner: jest.fn() };
    usage = {
      countActiveSeats: jest.fn(),
      countBoards: jest.fn(),
      countOwnedWorkspaces: jest.fn(),
      findActiveMemberRole: jest.fn(),
      findOwnerId: jest.fn(),
    };
    service = new UsageService(
      usage as unknown as UsageRepository,
      subs as unknown as BillingRepository,
      new BillingPolicy(),
    );
  });

  describe('getSubscriptionView', () => {
    it('returns the stored row mapped to a view', async () => {
      subs.findByWorkspace.mockResolvedValue({
        ...freeRow('ws-1'),
        plan: 'PRO',
        currentPeriodEnd: new Date('2026-01-31T00:00:00Z'),
      });
      const view = await service.getSubscriptionView('ws-1');
      expect(view).toMatchObject({
        workspaceId: 'ws-1',
        plan: 'PRO',
        status: 'ACTIVE',
      });
      expect(view.currentPeriodEnd?.toISOString()).toBe(
        '2026-01-31T00:00:00.000Z',
      );
    });
    it('defaults a missing row to FREE/ACTIVE (backfill safety)', async () => {
      subs.findByWorkspace.mockResolvedValue(undefined);
      const view = await service.getSubscriptionView('legacy-1');
      expect(view).toMatchObject({
        workspaceId: 'legacy-1',
        plan: 'FREE',
        status: 'ACTIVE',
      });
    });
  });

  describe('assertCanCreateBoard', () => {
    it('blocks the 4th board on FREE', async () => {
      subs.findByWorkspace.mockResolvedValue(freeRow('ws-1'));
      usage.countBoards.mockResolvedValue(3);
      await expect(service.assertCanCreateBoard('ws-1')).rejects.toMatchObject({
        code: 'BILLING.LIMIT_REACHED',
        details: {
          feature: 'boards',
          current: 3,
          limit: 3,
          plan: 'FREE',
        },
      });
    });
    it('allows creation on PRO regardless of count', async () => {
      subs.findByWorkspace.mockResolvedValue({
        ...freeRow('ws-1'),
        plan: 'PRO',
      });
      usage.countBoards.mockResolvedValue(99);
      await expect(
        service.assertCanCreateBoard('ws-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanAddMember', () => {
    it('blocks an invitation above 3 active seats on FREE', async () => {
      subs.findByWorkspace.mockResolvedValue(freeRow('ws-1'));
      usage.countActiveSeats.mockResolvedValue(3);
      await expect(service.assertCanAddMember('ws-1')).rejects.toMatchObject({
        code: 'BILLING.LIMIT_REACHED',
        details: {
          feature: 'members',
          current: 3,
          limit: 3,
          plan: 'FREE',
        },
      });
    });
  });

  describe('assertCanOwnWorkspace', () => {
    it('blocks a second owned workspace when every owned sub is FREE', async () => {
      subs.findPlansByOwner.mockResolvedValue(['FREE', 'FREE']);
      usage.countOwnedWorkspaces.mockResolvedValue(1);
      await expect(service.assertCanOwnWorkspace('u-1')).rejects.toMatchObject({
        code: 'BILLING.LIMIT_REACHED',
        details: {
          feature: 'ownedWorkspaces',
          current: 1,
          limit: 1,
          plan: 'FREE',
        },
      });
    });
    it('allows many owned workspaces when the user owns a PAID workspace', async () => {
      subs.findPlansByOwner.mockResolvedValue(['PRO']);
      usage.countOwnedWorkspaces.mockResolvedValue(5);
      await expect(
        service.assertCanOwnWorkspace('u-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('requireFeature', () => {
    it('throws FEATURE_REQUIRED on PRO for AUDIT_LOG_EXPORT', async () => {
      subs.findByWorkspace.mockResolvedValue({
        ...freeRow('ws-1'),
        plan: 'PRO',
      });
      await expect(
        service.requireFeature('ws-1', 'AUDIT_LOG_EXPORT'),
      ).rejects.toMatchObject({
        code: 'BILLING.FEATURE_REQUIRED',
        details: { feature: 'AUDIT_LOG_EXPORT', plan: 'PRO' },
      });
    });
    it('passes on TEAM', async () => {
      subs.findByWorkspace.mockResolvedValue({
        ...freeRow('ws-1'),
        plan: 'TEAM',
      });
      await expect(
        service.requireFeature('ws-1', 'AUDIT_LOG_EXPORT'),
      ).resolves.toBeUndefined();
    });
  });

  describe('requireWorkspaceRole', () => {
    it('rejects non-members and below-ADMIN roles with FORBIDDEN', async () => {
      usage.findActiveMemberRole.mockResolvedValue('EDITOR');
      await expect(
        service.requireWorkspaceRole('ws-1', 'u-1', 'ADMIN'),
      ).rejects.toMatchObject({ code: 'BILLING.FORBIDDEN' });
      usage.findActiveMemberRole.mockResolvedValue(undefined);
      await expect(
        service.requireWorkspaceRole('ws-1', 'u-1', 'ADMIN'),
      ).rejects.toMatchObject({ code: 'BILLING.FORBIDDEN' });
    });
    it('accepts ADMIN and OWNER', async () => {
      usage.findActiveMemberRole.mockResolvedValue('OWNER');
      await expect(
        service.requireWorkspaceRole('ws-1', 'u-1', 'ADMIN'),
      ).resolves.toBeUndefined();
    });
  });
});
