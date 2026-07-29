'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/auth';
import { KeyRound, CheckCircle, Eye, EyeOff, Check, X } from 'lucide-react';

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  barColor: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const barColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const textColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400'];
  return { score, label: labels[score] ?? '', barColor: barColors[score] ?? '', textColor: textColors[score] ?? '' };
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const strength = getPasswordStrength(password);
  const matchConfirm = confirm && password === confirm;

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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="w-full max-w-sm text-center">
          <CheckCircle size={40} className="mx-auto mb-4 text-emerald-500" />
          <h1 className="text-xl font-bold">Password changed</h1>
          <p className="mt-2 text-sm text-surface-400">
            Your password has been reset and all sessions were revoked.
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-6 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
          >
            Sign in with new password
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary-500/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 p-8 shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 shadow-sm shadow-primary-600/10">
              <KeyRound size={20} className="text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Set new password</h1>
              <p className="text-sm text-surface-400">Minimum 12 characters</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <div className="mt-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.score ? strength.barColor : 'bg-surface-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`mt-0.5 text-xs ${strength.textColor}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                  placeholder="••••••••••••"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {confirm && (
                    matchConfirm ? (
                      <Check size={16} className="text-emerald-500" />
                    ) : (
                      <X size={16} className="text-red-500" />
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="text-surface-500 hover:text-surface-300"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !token}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? 'Resetting…' : 'Reset password'}
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
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
