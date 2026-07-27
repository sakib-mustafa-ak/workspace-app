'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/auth';
import { KeyRound, CheckCircle } from 'lucide-react';

export default function RequestPasswordResetPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle size={40} className="mx-auto mb-4 text-emerald-500" />
          <h1 className="text-xl font-bold">Check your inbox</h1>
          <p className="mt-2 text-sm text-surface-400">
            If an account exists for {email}, we&apos;ve sent a password reset link.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
          >
            Back to login
          </Link>
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
            <h1 className="text-xl font-bold">Reset your password</h1>
            <p className="text-sm text-surface-400">We&apos;ll send you a reset link</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-surface-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
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
