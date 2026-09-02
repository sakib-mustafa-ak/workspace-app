'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import {
  billingApi,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLACEHOLDER_PRICES,
  type SubscriptionInfo,
} from '@/lib/billing';
import { useToast } from '@/contexts/toast-context';

type Props = {
  workspaceId: string;
  subscription: SubscriptionInfo | null;
  canManage: boolean;
  boardCount: number;
  memberCount: number;
  onChanged: () => void;
};

function usageLabel(current: number, limit: number | null): string {
  return limit === null ? `${current} / unlimited` : `${current} / ${limit}`;
}

export function BillingSection({ workspaceId, subscription, canManage, boardCount, memberCount }: Props) {
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);
  const toast = useToast();
  const plan = subscription?.plan ?? 'FREE';

  async function upgrade(target: 'PRO' | 'TEAM') {
    setBusy('checkout');
    try {
      const { url } = await billingApi.checkout(workspaceId, target);
      window.location.href = url;
    } catch {
      toast.error('Could not start checkout. Try again.');
      setBusy(null);
    }
  }

  async function manage() {
    setBusy('portal');
    try {
      const { url } = await billingApi.portal(workspaceId);
      window.location.href = url;
    } catch {
      toast.error('Could not open billing. Try again.');
      setBusy(null);
    }
  }

  const paid = plan !== 'FREE';
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard size={14} className="text-surface-500" />
          Plan &amp; billing
        </h3>
        <span className="rounded-full bg-surface-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-300">
          {PLAN_LABELS[plan]}
          {!subscription || subscription.status !== 'ACTIVE' ? ` · ${subscription?.status ?? 'ACTIVE'}` : ''}
        </span>
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-surface-400">Boards</dt>
          <dd className="text-surface-200">{usageLabel(boardCount, PLAN_LIMITS[plan].boards)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-surface-400">Members</dt>
          <dd className="text-surface-200">{usageLabel(memberCount, PLAN_LIMITS[plan].members)}</dd>
        </div>
        {paid && periodEnd && (
          <div className="flex justify-between">
            <dt className="text-surface-400">Renews</dt>
            <dd className="text-surface-200">{periodEnd}</dd>
          </div>
        )}
      </dl>

      {canManage &&
        (paid ? (
          <button
            onClick={manage}
            disabled={busy !== null}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-700 px-3 py-2 text-xs font-medium text-surface-300 hover:border-primary-600 hover:text-primary-300 disabled:opacity-50"
          >
            <ExternalLink size={13} />
            {busy === 'portal' ? 'Opening…' : 'Manage billing'}
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => upgrade('PRO')}
              disabled={busy !== null}
              className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              Upgrade to Pro · {PLACEHOLDER_PRICES.PRO.monthly}/mo
            </button>
            <button
              onClick={() => upgrade('TEAM')}
              disabled={busy !== null}
              className="rounded-lg border border-primary-700/60 px-3 py-2 text-xs font-medium text-primary-300 hover:bg-primary-900/40 disabled:opacity-50"
            >
              Upgrade to Team · {PLACEHOLDER_PRICES.TEAM.monthly}/mo
            </button>
          </div>
        ))}
    </div>
  );
}
