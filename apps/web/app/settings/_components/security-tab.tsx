'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Loader2, Laptop, Shield } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';

type Session = {
  id: string;
  deviceName: string;
  browser: string;
  ip: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
};

export function SecurityTab() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.get<Session[]>('/auth/sessions').then(setSessions).catch(() => {});
  }, []);

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      toast.error('Failed to revoke session. Please try again.');
    }
    finally { setRevoking(null); }
  }

  return (
    <div className="space-y-6">
      <Section title="Change password">
        <form onSubmit={handleChangePw} className="space-y-3">
          {pwError && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">{pwError}</div>}
          {pwSuccess && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">Password changed successfully.</div>}
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50" required />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (min 8 chars)" className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50" required />
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" className="w-full rounded-lg border border-surface-800 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-primary-500/50" required />
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium transition-colors hover:bg-primary-500 disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}Change password
            </button>
          </div>
        </form>
      </Section>

      <Section title="Active sessions">
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900/50 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Laptop size={16} className="text-surface-400" />
                  <span className="text-sm font-medium text-surface-200">{s.deviceName || s.browser || 'Unknown device'}</span>
                  {s.isCurrent && <span className="rounded bg-primary-600/20 px-1.5 py-0.5 text-caption text-primary-400">Current</span>}
                </div>
                <p className="mt-0.5 text-xs text-surface-500">{s.ip} &middot; {new Date(s.lastActiveAt).toLocaleDateString()}</p>
              </div>
              {!s.isCurrent && (
                <button onClick={() => revokeSession(s.id)} disabled={revoking === s.id} className="rounded-lg px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                  {revoking === s.id ? 'Revoking...' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
          {sessions.length === 0 && <p className="py-4 text-center text-sm text-surface-500">No sessions found.</p>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-300">
        <Shield size={14} className="text-surface-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}
