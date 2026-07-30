'use client';

import { type LucideIcon } from 'lucide-react';

type Tab = { id: string; label: string; icon: LucideIcon };

type Props = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
};

export function TabNav({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div className="flex gap-1 rounded-xl border border-surface-800 bg-surface-900/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-surface-800 text-white shadow-sm'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
