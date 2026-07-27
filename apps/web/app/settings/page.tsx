'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usersApi } from '@/lib/users';
import { User, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const updated = await usersApi.updateMe({ displayName });
      setSaved(true);
      if (user) {
        localStorage.setItem('user', JSON.stringify({ ...user, displayName: updated.displayName }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <div className="mb-8 flex items-center gap-3">
        <User size={24} className="text-primary-500" />
        <div>
          <h1 className="text-xl font-bold">Profile settings</h1>
          <p className="text-sm text-surface-400">Manage your profile information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {saved && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-400">
            Profile updated successfully.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5 text-surface-300">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm text-surface-500 outline-none"
          />
          <p className="mt-1 text-xs text-surface-500">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-surface-300">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
            placeholder="Your name"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
