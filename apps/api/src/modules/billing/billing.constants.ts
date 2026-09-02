import {
  PLAN_FEATURES as PLANS_FEATURES_KEYS,
  PLAN_FEATURE_BY_ID,
  PLAN_LABELS as PLANS_LABELS,
  PLAN_LIMITS as PLANS_LIMITS,
  PLAN_RANK as PLANS_RANK,
  PRICED_PLAN_IDS,
  isPricedPlanId,
  type PlanFeature,
  type PlanId,
  type PricedPlanId,
} from '@repo/plans';

/**
 * Plan identity and limitation data comes from the shared `@repo/plans`
 * package — the single source of truth that also drives the public pricing
 * page and web billing UI. This file re-exports that data under the names
 * this module's consumers already use, so enforcement and display can never
 * drift apart.
 */
export type BillingPlan = PlanId;

export const PRICED_PLANS = PRICED_PLAN_IDS;
export type PricedPlan = PricedPlanId;
export function isPricedPlan(value: string | undefined): value is PricedPlan {
  return isPricedPlanId(value);
}

export const PLAN_RANK = PLANS_RANK;

export const PLAN_LIMITS = PLANS_LIMITS;

export const BILLING_FEATURES = PLANS_FEATURES_KEYS;
export type BillingFeature = PlanFeature;

export const PLAN_FEATURES = PLAN_FEATURE_BY_ID;

// Display-only metadata. Prices are explicit placeholders until confirmed
// (see PRICED_PLAN_MONTHLY_PRICE_CENTS in @repo/plans); surfaced on the
// public pricing page, never enforced.
export const PLACEHOLDER_PRICES = Object.fromEntries(
  PRICED_PLAN_IDS.map((plan) => [plan, { monthly: 0 }]),
) as Record<PricedPlan, { monthly: number }>;

export const PLAN_LABELS = PLANS_LABELS;
