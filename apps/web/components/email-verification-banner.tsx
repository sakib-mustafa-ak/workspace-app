'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { requestVerification } from '@/lib/auth';
import {
  Mail,
  MailCheck,
  Loader2,
  Send,
  X,
} from 'lucide-react';

export function EmailVerificationBanner() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const verify = searchParams.get('verify');
    if (!verify) return;
    if (verify === 'success') {
      setToast({ type: 'success', message: 'Email verified successfully!' });
      refreshUser();
    } else if (verify === 'missing-token') {
      setToast({ type: 'error', message: 'Missing verification token.' });
    } else if (verify === 'error') {
      setToast({ type: 'error', message: searchParams.get('message') || 'Verification failed' });
    }
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }, [searchParams, refreshUser]);

  const isVerified = !!user?.emailVerifiedAt;

  if (!user || isVerified || dismissed) return null;

  async function handleSend() {
    setSending(true);
    try {
      await requestVerification(user!.email);
      setSent(true);
    } catch {
      setToast({ type: 'error', message: 'Failed to send verification email' });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {toast && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {toast.type === 'success' ? (
            <MailCheck size={16} className="shrink-0" />
          ) : (
            <X size={16} className="shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
              <Mail size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-300">Verify your email</p>
              <p className="mt-0.5 text-xs text-amber-400/70">
                Please verify your email address ({user.email}) to access all features.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sent ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <MailCheck size={14} />
                Verification sent
              </span>
            ) : (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3.5 py-2 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {sending ? 'Sending…' : 'Send verification'}
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-400/50 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
