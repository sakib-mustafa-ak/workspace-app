import { api } from './api';

export type BillingPlan = 'FREE' | 'PRO' | 'TEAM';

export type SubscriptionInfo = {
  workspaceId: string;
  plan: BillingPlan;
  status: string;
  currentPeriodEnd: string | null;
};

export const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};

export const PLACEHOLDER_PRICES: Record<'PRO' | 'TEAM', { monthly: string }> = {
  // TODO: confirm pricing before launch (keep in sync with the API)
  PRO: { monthly: '$0' },
  TEAM: { monthly: '$0' },
};

export const billingApi = {
  getSubscription: (workspaceId: string) =>
    api.get<SubscriptionInfo>(`/workspaces/${workspaceId}/subscription`),

  checkout: (workspaceId: string, plan: 'PRO' | 'TEAM') =>
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
