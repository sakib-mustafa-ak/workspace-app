'use client';

import { useState, useEffect } from 'react';
import { usersApi, type UserProfile } from '@/lib/users';
import { Save, Loader2 } from 'lucide-react';

export function ProfileTab() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    usersApi.getMe().then((p) => {
      setProfile(p);
      setName(p.displayName || '');
      setBio(p.bio || '');
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const updated = await usersApi.updateMe({ displayName: name });
      if (profile) setProfile({ ...profile, ...updated });
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">Profile updated.</div>
      )}

      <Section title="Avatar">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-surface-600 to-surface-700 text-xl font-bold text-surface-200 shadow-sm">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm text-surface-500">Avatar upload coming soon</div>
        </div>
      </Section>

      <Section title="Display name">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50"
        />
        <p className="mt-1 text-right text-xs text-surface-500">{name.length}/50</p>
      </Section>

      <Section title="Email">
        <p className="text-sm text-surface-400">{profile?.email || '—'}</p>
      </Section>

      <Section title="Bio">
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={4}
          maxLength={500}
          className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50"
        />
        <p className="mt-1 text-right text-xs text-surface-500">{bio.length}/500</p>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          <Save size={14} />
          Save changes
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
      <h3 className="mb-3 text-sm font-semibold text-surface-300">{title}</h3>
      {children}
    </div>
  );
}
