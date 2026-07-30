# Phase 7: Settings Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a tabbed settings page with Profile, Security, Preferences, and Danger Zone tabs. New backend endpoints for session management and notification preferences.

**Architecture:** Single `apps/web/app/settings/` route with tab navigation via URL search params (`?tab=`). Each tab is a separate component. Backend endpoints live alongside existing auth routes.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react

## Global Constraints

- Unsaved changes warning before navigating away (`beforeunload` + router guard)
- Save action shows toast notification
- Session revoke and account delete require confirmation modals
- Multi-step confirmation for account delete (type "DELETE" to confirm)
- No new npm dependencies

---

### Task 1: Settings page layout and tab navigation

**Files:**
- Create: `apps/web/app/settings/page.tsx`
- Create: `apps/web/app/settings/_components/tab-nav.tsx`
- Create: `apps/web/app/settings/_components/profile-tab.tsx`
- Create: `apps/web/app/settings/_components/security-tab.tsx`
- Create: `apps/web/app/settings/_components/preferences-tab.tsx`
- Create: `apps/web/app/settings/_components/danger-tab.tsx`

- [ ] **Step 1: Create settings layout with tab navigation**

```tsx
// apps/web/app/settings/page.tsx
'use client';

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

  const setActiveTab = (tab: string) => {
    router.push(`/settings?tab=${tab}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      {/* Tab bar */}
      <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="mt-8">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'danger' && <DangerTab />}
      </div>

      <UnsavedChangesWarning />
    </div>
  );
}
```

- [ ] **Step 2: Build TabNav component**

```tsx
// tab-nav.tsx
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
```

- [ ] **Step 3: Create UnsavedChangesWarning component**

```tsx
function UnsavedChangesWarning() {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);

  // Expose setDirty via context or prop drilling
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Router guard
  useEffect(() => {
    if (!dirty) return;
    const onRouteChange = (url: string) => {
      if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
        throw 'route change aborted';
      }
    };
    // Use router.events or a custom solution
  }, [dirty]);

  return null;
}
```

- [ ] **Step 4: Create placeholder tab components (empty divs with tab label)**

Create each `*-tab.tsx` with a placeholder for now.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/settings/
git commit -m "feat(settings): add settings page layout with tab navigation and unsaved changes warning"
```

---

### Task 2: Profile tab

**Files:**
- Modify: `apps/web/app/settings/_components/profile-tab.tsx`
- Create: `apps/web/lib/api/settings.ts`

- [ ] **Step 1: Create settings API service**

```ts
// apps/web/lib/api/settings.ts
export const settingsApi = {
  getProfile: () => api.get<User>('/auth/me'),

  updateProfile: (data: { name?: string; bio?: string; avatarUrl?: string }) =>
    api.patch<User>('/auth/me', data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<User>('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
```

- [ ] **Step 2: Build Profile tab form**

```tsx
// profile-tab.tsx
export function ProfileTab() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.getProfile().then((user) => {
      setName(user.name);
      setBio(user.bio || '');
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    await settingsApi.updateProfile({ name, bio });
    setSaving(false);
    toast.success('Profile updated');
  }

  return (
    <div className="space-y-6">
      {/* Avatar upload */}
      <Section title="Avatar">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-700 text-xl font-bold">
            {avatarPreview ? <img src={avatarPreview} className="h-full w-full rounded-full object-cover" /> : name.charAt(0)}
          </div>
          <label className="cursor-pointer rounded-lg bg-surface-800 px-4 py-2 text-sm transition-colors hover:bg-surface-700">
            Upload photo
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
      </Section>

      {/* Display name */}
      <Section title="Display name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50"
        />
        <p className="mt-1 text-right text-xs text-surface-500">{name.length}/50</p>
      </Section>

      {/* Bio */}
      <Section title="Bio">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={500}
          className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50"
        />
        <p className="mt-1 text-right text-xs text-surface-500">{bio.length}/500</p>
      </Section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire dirty tracking for unsaved changes warning**

Use a `useDirtyForm` pattern: compare current values to initial values. Set `dirty=true` when any field differs.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/settings/_components/profile-tab.tsx apps/web/lib/api/settings.ts
git commit -m "feat(settings): add profile tab with avatar upload, name/bio editing, character count"
```

---

### Task 3: Security tab — password change and session management

**Files:**
- Modify: `apps/web/app/settings/_components/security-tab.tsx`

- [ ] **Step 1: Add change password form**

```tsx
function ChangePasswordForm() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
    setSaving(false);
    toast.success('Password changed');
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  }
  // Render form with 3 password fields + submit
}
```

- [ ] **Step 2: Add session management section**

Backend: `GET /auth/sessions` and `DELETE /auth/sessions/:id`.

```ts
interface Session {
  id: string;
  deviceName: string;
  browser: string;
  ip: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}
```

```tsx
function SessionManagement() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    api.get<Session[]>('/auth/sessions').then(setSessions);
  }, []);

  async function revokeSession(id: string) {
    await api.delete(`/auth/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success('Session revoked');
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div key={session.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900/50 p-4">
          <div>
            <div className="flex items-center gap-2">
              <Laptop size={16} className="text-surface-400" />
              <span className="text-sm font-medium">{session.deviceName || session.browser}</span>
              {session.isCurrent && <span className="rounded bg-primary-600/20 px-1.5 py-0.5 text-[10px] text-primary-400">Current</span>}
            </div>
            <p className="mt-0.5 text-xs text-surface-500">{session.ip} &middot; Last active {formatRelativeDate(session.lastActiveAt)}</p>
          </div>
          {!session.isCurrent && (
            <button
              onClick={() => revokeSession(session.id)}
              className="rounded-lg px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
            >
              Revoke
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(settings): add security tab with password change and session management"
```

---

### Task 4: Preferences tab

**Files:**
- Modify: `apps/web/app/settings/_components/preferences-tab.tsx`

- [ ] **Step 1: Add backend types and API calls**

Backend: `GET /notification-preferences`, `PATCH /notification-preferences`.

```ts
interface NotificationPreferences {
  email: { mentions: boolean; comments: boolean; invitations: boolean; updates: boolean };
  push: { mentions: boolean; comments: boolean; invitations: boolean; updates: boolean };
}
```

- [ ] **Step 2: Build preferences form**

```tsx
export function PreferencesTab() {
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/auth/me').then((u: any) => { setTimezone(u.timezone || ''); setLocale(u.locale || ''); }),
      api.get('/notification-preferences').then(setNotifPrefs),
    ]);
  }, []);

  // Timezone select (populate from Intl.supportedValuesOf('timeZone'))
  // Locale select (populate from Intl.sortedAvailableLocales)
  // Notification toggles per channel+event

  return (
    <div className="space-y-6">
      <Section title="Timezone">
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm">
          {Intl.supportedValuesOf('timeZone').map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Section>

      <Section title="Locale">
        <select value={locale} onChange={(e) => setLocale(e.target.value)} className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm">
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="ja">日本語</option>
        </select>
      </Section>

      <Section title="Notification preferences">
        {notifPrefs && ['email', 'push'].map((channel) => (
          <div key={channel}>
            <p className="mb-2 text-sm font-medium capitalize text-surface-400">{channel}</p>
            {Object.entries(notifPrefs[channel as keyof NotificationPreferences]).map(([key, val]) => (
              <label key={key} className="flex items-center justify-between py-2">
                <span className="text-sm capitalize">{key}</span>
                <Toggle checked={val} onChange={(v) => togglePref(channel, key, v)} />
              </label>
            ))}
          </div>
        ))}
      </Section>

      <div className="flex justify-end">
        <button onClick={handleSave} className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium hover:bg-primary-500">
          Save preferences
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(settings): add preferences tab with timezone, locale, notification toggles"
```

---

### Task 5: Danger Zone — account deletion

**Files:**
- Modify: `apps/web/app/settings/_components/danger-tab.tsx`

- [ ] **Step 1: Build danger zone UI with multi-step confirmation**

```tsx
export function DangerTab() {
  const [step, setStep] = useState<'initial' | 'confirm' | 'deleting'>('initial');
  const [confirmText, setConfirmText] = useState('');

  async function handleDelete() {
    setStep('deleting');
    await api.delete('/auth/account');
    // Redirect to logout / goodbye page
    router.push('/auth/login');
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
        <p className="mt-1 text-sm text-surface-400">
          Deleting your account is permanent. All your data, workspaces, and boards will be removed.
        </p>

        {step === 'initial' && (
          <button
            onClick={() => setStep('confirm')}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            Delete my account
          </button>
        )}

        {step === 'confirm' && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-surface-300">
              Type <strong>DELETE</strong> below to confirm:
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full max-w-xs rounded-lg border border-red-500/30 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setStep('initial')}
                className="rounded-lg bg-surface-800 px-4 py-2 text-sm transition-colors hover:bg-surface-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || step === 'deleting'}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {step === 'deleting' && <Loader2 size={14} className="animate-spin" />}
                Permanently delete my account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(settings): add danger zone tab with multi-step account deletion"
```
