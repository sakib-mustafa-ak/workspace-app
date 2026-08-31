import { Injectable } from '@nestjs/common';

import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_RANK,
  type BillingFeature,
  type BillingPlan,
} from '../billing.constants';

/**
 * Pure decision logic for plan limits and feature gating. No I/O.
 * Services ask the policy BEFORE hitting the database where possible,
 * and after counting where they need facts.
 */
@Injectable()
export class BillingPolicy {
  public canCreateBoard(plan: BillingPlan, currentBoards: number): boolean {
    const limit = PLAN_LIMITS[plan].boards;
    return limit === null || currentBoards < limit;
  }

  public canAddMember(plan: BillingPlan, currentActiveSeats: number): boolean {
    const limit = PLAN_LIMITS[plan].members;
    return limit === null || currentActiveSeats < limit;
  }

  public canOwnWorkspace(plan: BillingPlan, currentOwned: number): boolean {
    const limit = PLAN_LIMITS[plan].ownedWorkspaces;
    return limit === null || currentOwned < limit;
  }

  public hasFeature(plan: BillingPlan, feature: BillingFeature): boolean {
    return PLAN_FEATURES[plan].includes(feature);
  }

  public highestPlan(plans: BillingPlan[]): BillingPlan {
    return plans.reduce<BillingPlan>(
      (acc, p) => (PLAN_RANK[p] > PLAN_RANK[acc] ? p : acc),
      'FREE',
    );
  }
}
