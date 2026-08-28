'use client';

import { useMemo, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { type UserProfile } from '@/lib/users';
import { Save, Loader2, Globe, Clock, Check, ChevronDown, Search, Bell } from 'lucide-react';
import { SkeletonBlock } from '@/components/skeleton';
import {
  notificationPreferencesApi,
  NOTIFICATION_TYPE_LABELS,
  type NotificationPreference,
} from '@/lib/notification-preferences';

const LOCALES = [
  { value: '', label: 'System default' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
];

export function PreferencesTab() {
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tzOpen, setTzOpen] = useState(false);
  const [tzSearch, setTzSearch] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const allTimezones = useMemo(
    () => (typeof Intl !== 'undefined' ? Intl.supportedValuesOf('timeZone') : []),
    [],
  );

  // Group timezones by region (first path segment) for a browsable list.
  const tzGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const tz of allTimezones) {
      const region = tz.includes('/') ? tz.split('/')[0]! : 'Other';
      const list = groups.get(region) ?? [];
      list.push(tz);
      groups.set(region, list);
    }
    return [...groups.entries()].map(([region, zones]) => ({
      region,
      zones: zones.sort(),
    }));
  }, [allTimezones]);

  const filteredGroups = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return tzGroups;
    return tzGroups
      .map((g) => ({ ...g, zones: g.zones.filter((z) => z.toLowerCase().includes(q)) }))
      .filter((g) => g.zones.length > 0);
  }, [tzGroups, tzSearch]);

  useEffect(() => {
    setLoading(true);
    api
      .get<UserProfile>('/auth/me')
      .then((u) => {
        setTimezone(u.timezone || '');
        setLocale(u.locale || '');
      })
      .catch(() => { /* handled */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    notificationPreferencesApi
      .get()
      .then((res) => {
        setNotificationPrefs(res.preferences);
        setPrefsLoaded(true);
      })
      .catch(() => {
        setPrefsLoaded(true);
      });
  }, []);

  function togglePref(type: string, key: 'emailEnabled' | 'inAppEnabled') {
    setNotificationPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [key]: !p[key] } : p)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await api.patch('/users/me', { timezone: timezone || null, locale: locale || null });
      if (notificationPrefs.length > 0) {
        await notificationPreferencesApi.update(notificationPrefs);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">{saveError}</div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          Preferences saved.
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : (
        <>
          <Section icon={Clock} title="Timezone">
            <p className="mb-2 text-xs text-surface-500">
              Choose how dates and times are displayed across your workspaces.
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setTzOpen(o => !o); setTzSearch(''); }}
                className="flex w-full items-center justify-between rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none transition-colors hover:border-surface-700 focus:border-primary-500/50"
              >
                <span className={timezone ? 'text-surface-100' : 'text-surface-500'}>
                  {timezone || 'System default'}
                </span>
                <ChevronDown size={14} className={`text-surface-500 transition-transform ${tzOpen ? 'rotate-180' : ''}`} />
              </button>
              {tzOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-surface-700 bg-surface-900 shadow-xl">
                  <div className="flex items-center gap-2 border-b border-surface-800 px-3 py-2">
                    <Search size={13} className="text-surface-500" />
                    <input
                      value={tzSearch}
                      onChange={(e) => setTzSearch(e.target.value)}
                      placeholder="Search timezones…"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-surface-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {filteredGroups.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-surface-500">No timezones match</p>
                    )}
                    {filteredGroups.map((g) => (
                      <div key={g.region} className="mb-1 last:mb-0">
                        <p className="px-3 pb-1 pt-2 text-caption font-medium uppercase tracking-wider text-surface-600">{g.region}</p>
                        {g.zones.map((tz) => (
                          <button
                            key={tz}
                            type="button"
                            onClick={() => { setTimezone(tz); setTzOpen(false); }}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                              timezone === tz ? 'bg-primary-600/15 text-primary-200' : 'text-surface-300 hover:bg-surface-800'
                            }`}
                          >
                            {tz}
                            {timezone === tz && <Check size={13} className="text-primary-400" />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section icon={Globe} title="Locale">
            <p className="mb-2 text-xs text-surface-500">
              Language and regional formatting for your account.
            </p>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none transition-colors hover:border-surface-700 focus:border-primary-500/50"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </Section>

          <Section icon={Bell} title="Notifications">
            <p className="mb-2 text-xs text-surface-500">
              Choose which notifications you receive and how.
            </p>
            {!prefsLoaded ? (
              <div className="py-6 text-center text-xs text-surface-500">Loading…</div>
            ) : (
              <div className="space-y-4">
                {notificationPrefs.map((p) => (
                  <div
                    key={p.type}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-surface-300">
                      {NOTIFICATION_TYPE_LABELS[p.type] ?? p.type}
                    </span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-surface-500">
                        <input
                          type="checkbox"
                          checked={p.emailEnabled}
                          onChange={() => togglePref(p.type, 'emailEnabled')}
                          disabled={p.type === 'MENTION_CREATED'}
                          className="accent-primary-500"
                        />
                        Email
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-surface-500">
                        <input
                          type="checkbox"
                          checked={p.inAppEnabled}
                          onChange={() => togglePref(p.type, 'inAppEnabled')}
                          disabled={p.type === 'MENTION_CREATED'}
                          className="accent-primary-500"
                        />
                        In-app
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          <Save size={14} />
          Save preferences
        </button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-300">
        <Icon size={14} className="text-surface-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}
