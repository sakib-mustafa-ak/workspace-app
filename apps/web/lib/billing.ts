import { api } from './api';

import {
  PLAN_LABELS,
  PLAN_LIMITS,
  PRICED_PLAN_MONTHLY_PRICE_CENTS,
  type PlanId,
  type PricedPlanId,
} from '@repo/plans';

// Re-exported so existing call sites keep their naming. The values come from
// the shared `@repo/plans` package — the same source of truth the API uses
// for enforcement — so the UI can never drift from the enforcement limits.
export type BillingPlan = PlanId;
export type PricedPlan = PricedPlanId;
export { PLAN_LABELS, PLAN_LIMITS };

export type SubscriptionInfo = {
  workspaceId: string;
  plan: BillingPlan;
  status: string;
  currentPeriodEnd: string | null;
};

/**
 * Display formatter for prices. NOTE: prices are not confirmed yet — the
 * source of truth ships `0` (see PRICED_PLAN_MONTHLY_PRICE_CENTS), so we
 * surface a clear "Coming soon" placeholder rather than inventing a final
 * number.
 */
export const PLACEHOLDER_PRICES: Record<PricedPlan, { monthly: string }> = {
  PRO: { monthly: formatPrice(PRICED_PLAN_MONTHLY_PRICE_CENTS.PRO) },
  TEAM: { monthly: formatPrice(PRICED_PLAN_MONTHLY_PRICE_CENTS.TEAM) },
};

function formatPrice(cents: number): string {
  return cents === 0 ? 'Coming soon' : `$${cents / 100}/mo`;
}

export const billingApi = {
  getSubscription: (workspaceId: string) =>
    api.get<SubscriptionInfo>(`/workspaces/${workspaceId}/subscription`),

  checkout: (workspaceId: string, plan: PricedPlan) =>
    api.post<{ url: string }>('/billing/checkout', { workspaceId, plan }),

  portal: (workspaceId: string) =>
    api.post<{ url: string }>('/billing/portal', { workspaceId }),

  exportAudit: async (workspaceId: string, format: 'json' | 'csv') => {
    const payload = await api.get<{ fileName: string; contentType: string; data: string }>(
      `/workspaces/${workspaceId}/audit/export?format=${format}`,
    );
    const blob = new Blob([payload.data], { type: payload.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload.fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};
