'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { workspacesApi } from '@/lib/workspaces';
import { Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';

function AcceptInvitationInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [workspaceId, setWorkspaceId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let selector = searchParams.get('selector') ?? '';
    let verifier = searchParams.get('verifier') ?? '';

    if (!selector || !verifier) {
      const token = searchParams.get('token');
      if (token && token.includes(':')) {
        const parts = token.split(':');
        selector = parts[0] ?? '';
        verifier = parts[1] ?? '';
      }
    }

    if (!selector || !verifier) {
      setStatus('error');
      setMessage('Invalid invitation link. Missing selector or verifier.');
      return;
    }

    workspacesApi.acceptInvitation(selector, verifier)
      .then((res) => {
        setWorkspaceId(res.workspaceId);
        setStatus('success');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to accept invitation');
      });
  }, [searchParams]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary-500/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          {status === 'loading' && (
            <div className="text-center">
              <Loader2 size={40} className="mx-auto mb-4 animate-spin text-primary-500" />
              <h1 className="text-lg font-bold">Accepting invitation…</h1>
              <p className="mt-2 text-sm text-surface-400">Please wait while we process your invitation.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/10 shadow-sm shadow-emerald-600/10">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold">Invitation accepted!</h1>
              <p className="mt-2 text-sm text-surface-400">{message}</p>
              <button
                onClick={() => router.push(`/workspaces/${workspaceId}`)}
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
              >
                <LogIn size={16} />
                Go to workspace
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-red-600/20 to-red-600/10 shadow-sm shadow-red-600/10">
                <XCircle size={28} className="text-red-400" />
              </div>
              <h1 className="text-lg font-bold">Invitation failed</h1>
              <p className="mt-2 text-sm text-surface-400">{message}</p>
              <Link
                href="/dashboard"
                className="mt-6 inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
              >
                Go to dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    }>
      <AcceptInvitationInner />
    </Suspense>
  );
}
