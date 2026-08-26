'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';

export function DangerTab() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      router.push('/auth/login');
    } catch {
      toast.error('Failed to delete account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-400" />
        <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
      </div>
      <p className="mt-2 text-sm text-surface-400">
        Deleting your account is permanent. All your data, workspaces, and boards will be removed.
      </p>

      {!showConfirm ? (
        <button onClick={() => setShowConfirm(true)} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-surface-300">
            Type <strong>DELETE</strong> to confirm:
          </p>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full max-w-xs rounded-lg border border-red-500/30 bg-surface-950 px-4 py-2 text-sm outline-none focus:border-red-500"
          />
          <div className="flex gap-3">
            <button onClick={() => { setShowConfirm(false); setConfirmText(''); }} className="rounded-lg bg-surface-800 px-4 py-2 text-sm transition-colors hover:bg-surface-700">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Permanently delete my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
