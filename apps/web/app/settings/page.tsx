'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { User, Shield, Settings2, AlertTriangle } from 'lucide-react';
import { TabNav } from './_components/tab-nav';
import { ProfileTab } from './_components/profile-tab';
import { SecurityTab } from './_components/security-tab';
import { PreferencesTab } from './_components/preferences-tab';
import { DangerTab } from './_components/danger-tab';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Settings2 },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'profile';

  function setActiveTab(tab: string) {
    router.push(`/settings?tab=${tab}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold">Settings</h1>

      <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-8">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'danger' && <DangerTab />}
      </div>
    </div>
  );
}
