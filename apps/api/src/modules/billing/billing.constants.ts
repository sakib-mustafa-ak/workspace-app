import type { SubscriptionPlan } from '@repo/database';

export type BillingPlan = SubscriptionPlan;

export const PRICED_PLANS = ['PRO', 'TEAM'] as const;
export type PricedPlan = (typeof PRICED_PLANS)[number];
export function isPricedPlan(value: string | undefined): value is PricedPlan {
  return value === 'PRO' || value === 'TEAM';
}

export const PLAN_RANK: Record<BillingPlan, number> = { FREE: 0, PRO: 1, TEAM: 2 };

export type PlanLimits = { boards: number | null; members: number | null; ownedWorkspaces: number | null };

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  FREE: { boards: 3, members: 3, ownedWorkspaces: 1 },
  PRO: { boards: null, members: null, ownedWorkspaces: null },
  TEAM: { boards: null, members: null, ownedWorkspaces: null },
};

export const BILLING_FEATURES = {
  AUDIT_LOG_EXPORT: 'AUDIT_LOG_EXPORT',
  SSO: 'SSO',
  ADMIN_TOOLS: 'ADMIN_TOOLS',
} as const;
export type BillingFeature = (typeof BILLING_FEATURES)[keyof typeof BILLING_FEATURES];

export const PLAN_FEATURES: Record<BillingPlan, readonly BillingFeature[]> = {
  FREE: [],
  PRO: [],
  TEAM: [BILLING_FEATURES.AUDIT_LOG_EXPORT, BILLING_FEATURES.SSO, BILLING_FEATURES.ADMIN_TOOLS],
};

export const PLACEHOLDER_PRICES: Record<PricedPlan, { monthly: number }> = {
  // TODO: confirm pricing before launch
  PRO: { monthly: 0 },
  TEAM: { monthly: 0 },
};

export const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};
