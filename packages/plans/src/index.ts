export type PlanId = 'FREE' | 'PRO' | 'TEAM';

export type PlanLimits = {
  boards: number | null;
  members: number | null;
  ownedWorkspaces: number | null;
};

export type PricedPlanId = 'PRO' | 'TEAM';

export const PRICED_PLAN_IDS = ['PRO', 'TEAM'] as const satisfies readonly PricedPlanId[];

export function isPricedPlanId(value: string | undefined): value is PricedPlanId {
  return value === 'PRO' || value === 'TEAM';
}

export const PLAN_RANK: Record<PlanId, number> = {
  FREE: 0,
  PRO: 1,
  TEAM: 2,
};

/**
 * Hard per-plan limits used for enforcement on the API side. A `null` limit
 * means "unlimited". This is the single source of truth that both the API
 * (enforcement) and the public pricing page (display) read from, so the two
 * can never drift apart.
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: { boards: 3, members: 3, ownedWorkspaces: 1 },
  PRO: { boards: null, members: null, ownedWorkspaces: null },
  TEAM: { boards: null, members: null, ownedWorkspaces: null },
};

export const PLAN_FEATURES = {
  AUDIT_LOG_EXPORT: 'AUDIT_LOG_EXPORT',
  SSO: 'SSO',
  ADMIN_TOOLS: 'ADMIN_TOOLS',
} as const;
export type PlanFeature = (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES];

export const PLAN_FEATURE_BY_ID: Record<PlanId, readonly PlanFeature[]> = {
  FREE: [],
  PRO: [],
  TEAM: [
    PLAN_FEATURES.AUDIT_LOG_EXPORT,
    PLAN_FEATURES.SSO,
    PLAN_FEATURES.ADMIN_TOOLS,
  ],
};

export const PLAN_LABELS: Record<PlanId, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};

/**
 * Monthly prices, in cents, per priced plan.
 *
 * TODO: confirm pricing before launch. Do not treat these as final — they
 * are explicit placeholders with no real value so nothing that is accidentally
 * or intentionally relying on a "real-looking" number can mislead.
 */
export const PRICED_PLAN_MONTHLY_PRICE_CENTS: Record<PricedPlanId, number> = {
  PRO: 0,
  TEAM: 0,
};

/**
 * Feature taglines describing what actually ships in each plan, for the
 * public pricing page. Kept next to the enforcement data so the marketing
 * copy cannot contradict the enforced limits/features.
 */
export const PLAN_SHORT_DESCRIPTION: Record<PlanId, string> = {
  FREE: 'For small teams getting started',
  PRO: 'For growing teams that need more room',
  TEAM: 'For organizations that need control and oversight',
};
