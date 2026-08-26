'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { requestVerification } from '@/lib/auth';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';

export default function RequestVerificationPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestVerification(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="w-full max-w-sm text-center animate-fadeIn">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/10 shadow-sm shadow-emerald-600/10">
            <CheckCircle size={24} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold">Check your inbox</h1>
          <p className="mt-2 text-sm text-surface-400">
            If an account exists for {email}, we&apos;ve sent a verification link.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary-500/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="animate-fadeIn">
          <div className="rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 p-6 sm:p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 shadow-sm shadow-primary-600/10">
              <Mail size={20} className="text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Verify your email</h1>
              <p className="text-sm text-surface-400">We&apos;ll send you a verification link</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Sending verification link
                </span>
              ) : (
                'Send verification link'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-500">
            <Link href="/auth/login" className="font-medium text-primary-400 transition-colors hover:text-primary-300">
              Back to login
            </Link>
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
