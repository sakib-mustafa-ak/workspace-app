'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/auth';
import { KeyRound, CheckCircle } from 'lucide-react';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    if (!token) {
      setError('Missing reset token');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle size={40} className="mx-auto mb-4 text-emerald-500" />
          <h1 className="text-xl font-bold">Password changed</h1>
          <p className="mt-2 text-sm text-surface-400">
            Your password has been reset and all sessions were revoked.
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-6 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
          >
            Sign in with new password
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <KeyRound size={24} className="text-primary-500" />
          <div>
            <h1 className="text-xl font-bold">Set new password</h1>
            <p className="text-sm text-surface-400">Minimum 12 characters</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-surface-300">
              New password
            </label>
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-surface-300">
              Confirm password
            </label>
            <input
              type="password"
              required
              minLength={12}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !token}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-surface-400">
          <Link href="/auth/login" className="text-primary-400 hover:text-primary-300">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
