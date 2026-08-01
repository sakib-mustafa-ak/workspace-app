'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { LogIn, Loader2, Moon, Sun } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary-500/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-4 flex items-center gap-0.5 rounded-lg border border-surface-700/60 bg-surface-900/60 p-0.5">
          <button
            onClick={() => setTheme('dark')}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all ${theme === 'dark' ? 'bg-surface-800 text-primary-400 shadow-sm' : 'text-surface-400 hover:text-surface-200'}`}
          >
            <Moon size={13} />
            Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all ${theme === 'light' ? 'bg-surface-800 text-primary-400 shadow-sm' : 'text-surface-400 hover:text-surface-200'}`}
          >
            <Sun size={13} />
            Light
          </button>
        </div>
        <div className="animate-fadeIn">
          <div className="rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 p-6 sm:p-8 shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 shadow-sm shadow-primary-600/10">
              <LogIn size={20} className="text-primary-400" />
            </div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-surface-400">
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-surface-700/60 bg-surface-800/40 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 hover:border-surface-700 focus:border-primary-500/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-700/60 bg-surface-800/40 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 hover:border-surface-700 focus:border-primary-500/50"
                placeholder="••••••••"
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
                  Signing in
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link
              href="/auth/request-password-reset"
              className="text-surface-400 transition-colors hover:text-primary-300"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-surface-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/register"
            className="font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Create one
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
