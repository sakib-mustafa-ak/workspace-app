'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { type UserProfile } from '@/lib/users';
import { Save, Loader2, Bell, Smartphone, Trash2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

type NotifPrefs = {
  email: { mentions: boolean; comments: boolean; invitations: boolean; updates: boolean };
  push: { mentions: boolean; comments: boolean; invitations: boolean; updates: boolean };
};

const defaultNotifPrefs: NotifPrefs = {
  email: { mentions: true, comments: true, invitations: true, updates: false },
  push: { mentions: true, comments: false, invitations: true, updates: false },
};

export function PreferencesTab() {
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(defaultNotifPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { permission, subscriptions, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  const timezones = typeof Intl !== 'undefined' ? Intl.supportedValuesOf('timeZone') : [];

  useEffect(() => {
    Promise.all([
      api.get<UserProfile>('/auth/me').then((u) => { setTimezone(u.timezone || ''); setLocale(u.locale || ''); }).catch(() => {}),
      api.get<NotifPrefs>('/notification-preferences').then(setNotifPrefs).catch(() => {}),
    ]);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        api.patch('/notification-preferences', notifPrefs),
        api.patch('/users/me', { timezone, locale }),
      ]);
      setSaved(true);
    } catch { /* handled */ }
    finally { setSaving(false); }
  }

  function togglePref(channel: 'email' | 'push', key: string, val: boolean) {
    setNotifPrefs(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [key]: val },
    }));
  }

  return (
    <div className="space-y-6">
      {saved && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">Preferences saved.</div>}

      <Section title="Timezone">
        <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none">
          <option value="">System default</option>
          {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Section>

      <Section title="Locale">
        <select value={locale} onChange={e => setLocale(e.target.value)} className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none">
          <option value="">System default</option>
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="ja">日本語</option>
        </select>
      </Section>

      <Section title="Notification preferences">
        {(['email', 'push'] as const).map(channel => (
          <div key={channel} className="mb-4 last:mb-0">
            <p className="mb-2 text-sm font-medium capitalize text-surface-400">{channel}</p>
            {Object.entries(notifPrefs[channel]).map(([key, val]) => (
              <label key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm capitalize text-surface-300">{key}</span>
                <button
                  type="button"
                  onClick={() => togglePref(channel, key, !val)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${val ? 'bg-primary-600' : 'bg-surface-700'}`}
                >
                  <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${val ? 'translate-x-4' : ''}`} />
                </button>
              </label>
            ))}
          </div>
        ))}
      </Section>

      <Section title="Push Devices">
        {!('Notification' in window) ? (
          <p className="text-sm text-surface-500">Push notifications not supported in this browser.</p>
        ) : permission === 'denied' ? (
          <div>
            <p className="mb-2 text-sm text-red-400">Push notifications are blocked. Update your browser settings to enable them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Smartphone size={32} className="text-surface-600" />
                <p className="text-sm text-surface-400">No devices registered for push notifications.</p>
                <button onClick={subscribe} disabled={pushLoading} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50">
                  {pushLoading && <Loader2 size={14} className="animate-spin" />}
                  Enable push notifications
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {subscriptions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-surface-800 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Smartphone size={16} className="shrink-0 text-surface-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-surface-300">{s.userAgent || 'Unknown device'}</p>
                          <p className="text-[11px] text-surface-500">Registered {new Date(s.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button onClick={() => unsubscribe(s.id)} className="shrink-0 rounded p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-800" title="Remove device">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={subscribe} disabled={pushLoading} className="flex items-center gap-2 rounded-lg bg-surface-800 px-4 py-2 text-sm text-surface-300 hover:text-white disabled:opacity-50">
                    Add device
                  </button>
                  <button onClick={() => unsubscribe()} disabled={pushLoading} className="flex items-center gap-2 rounded-lg bg-surface-800 px-4 py-2 text-sm text-surface-400 hover:text-red-400 disabled:opacity-50">
                    Remove all
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Section>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium transition-colors hover:bg-primary-500 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}
          <Save size={14} />
          Save preferences
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-300">
        <Bell size={14} className="text-surface-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}
