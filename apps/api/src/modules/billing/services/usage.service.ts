import { Inject, Injectable } from '@nestjs/common';

import {
  WORKSPACE_ROLE_RANK,
  type SubscriptionStatus,
  type WorkspaceRole,
} from '@repo/database';

import { BillingRepository } from '../data/billing.repository';
import { UsageRepository } from '../data/usage.repository';
import { BillingPolicy } from '../policies/billing.policy';
import {
  BillingErrorCode,
  BillingException,
  FeatureRequiredException,
  LimitReachedException,
} from '../errors/billing.errors';
import {
  PLAN_LIMITS,
  type BillingFeature,
  type BillingPlan,
} from '../billing.constants';

export type SubscriptionView = {
  workspaceId: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
};

@Injectable()
export class UsageService {
  constructor(
    @Inject(UsageRepository) private readonly repo: UsageRepository,
    @Inject(BillingRepository) private readonly subs: BillingRepository,
    @Inject(BillingPolicy) private readonly policy: BillingPolicy,
  ) {}

  public async getSubscriptionView(
    workspaceId: string,
  ): Promise<SubscriptionView> {
    const row = await this.subs.findByWorkspace(workspaceId);
    return {
      workspaceId,
      plan: row?.plan ?? 'FREE',
      status: row?.status ?? 'ACTIVE',
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
    };
  }

  public async assertCanCreateBoard(workspaceId: string): Promise<void> {
    const plan = await this.planOf(workspaceId);
    const current = await this.repo.countBoards(workspaceId);
    if (!this.policy.canCreateBoard(plan, current)) {
      throw new LimitReachedException({
        feature: 'boards',
        current,
        limit: PLAN_LIMITS[plan].boards as number,
        plan,
      });
    }
  }

  public async assertCanAddMember(workspaceId: string): Promise<void> {
    const plan = await this.planOf(workspaceId);
    const current = await this.repo.countActiveSeats(workspaceId);
    if (!this.policy.canAddMember(plan, current)) {
      throw new LimitReachedException({
        feature: 'members',
        current,
        limit: PLAN_LIMITS[plan].members as number,
        plan,
      });
    }
  }

  public async assertCanOwnWorkspace(userId: string): Promise<void> {
    const plans = await this.subs.findPlansByOwner(userId);
    const plan = this.policy.highestPlan(plans.length > 0 ? plans : ['FREE']);
    const current = await this.repo.countOwnedWorkspaces(userId);
    if (!this.policy.canOwnWorkspace(plan, current)) {
      throw new LimitReachedException({
        feature: 'ownedWorkspaces',
        current,
        limit: PLAN_LIMITS[plan].ownedWorkspaces as number,
        plan,
      });
    }
  }

  public async requireFeature(
    workspaceId: string,
    feature: BillingFeature,
  ): Promise<void> {
    const plan = await this.planOf(workspaceId);
    if (!this.policy.hasFeature(plan, feature)) {
      throw new FeatureRequiredException({ feature, plan });
    }
  }

  public async requireWorkspaceRole(
    workspaceId: string,
    userId: string,
    minRole: WorkspaceRole,
  ): Promise<void> {
    const role = await this.repo.findActiveMemberRole(workspaceId, userId);
    if (!role || WORKSPACE_ROLE_RANK[role] < WORKSPACE_ROLE_RANK[minRole]) {
      throw new BillingException(
        BillingErrorCode.FORBIDDEN,
        'Insufficient workspace role.',
        403,
      );
    }
  }

  public async countActiveSeats(workspaceId: string): Promise<number> {
    return this.repo.countActiveSeats(workspaceId);
  }

  public async findOwnerId(workspaceId: string): Promise<string | undefined> {
    return this.repo.findOwnerId(workspaceId);
  }

  private async planOf(workspaceId: string): Promise<BillingPlan> {
    const row = await this.subs.findByWorkspace(workspaceId);
    return row?.plan ?? 'FREE';
  }
}
