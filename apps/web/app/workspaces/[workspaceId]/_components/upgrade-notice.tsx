'use client';

import { Sparkles } from 'lucide-react';

type Props = {
  plan: 'FREE' | 'PRO' | 'TEAM';
  boardCount: number;
  memberCount: number;
  onUpgrade: () => void;
};

export function UpgradeNotice({ plan, boardCount, memberCount, onUpgrade }: Props) {
  const atLimit = boardCount >= 3 || memberCount >= 3;
  if (plan !== 'FREE' || !atLimit) return null;

  const over = boardCount > 3 || memberCount > 3;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-900/40 bg-amber-950/40 px-8 py-2.5">
      <p className="flex items-center gap-2 text-xs text-amber-300">
        <Sparkles size={14} />
        {over
          ? `You're over the Free plan limits (${boardCount}/3 boards, ${memberCount}/3 members). Upgrade to keep creating.`
          : `You're at the Free plan limits (boards 3, members 3). Upgrade for unlimited everything.`}
      </p>
      <button
        onClick={onUpgrade}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
      >
        Upgrade
      </button>
    </div>
  );
}
