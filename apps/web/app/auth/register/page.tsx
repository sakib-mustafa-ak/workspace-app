'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  barColor: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  const barColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-500'];
  const textColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400', 'text-emerald-400'];
  return { score, label: labels[score] ?? '', barColor: barColors[score] ?? '', textColor: textColors[score] ?? '' };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(password);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email address';
    }
    if (password.length < 12) {
      errors.password = 'Password must be at least 12 characters';
    } else if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      errors.password =
        'Password must include uppercase, lowercase, a number, and a symbol';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(email, password, name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary-500/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="animate-fadeIn">
          <div className="rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 to-surface-900/60 p-6 sm:p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 shadow-sm shadow-primary-600/10">
              <UserPlus size={20} className="text-primary-400" />
            </div>
            <h1 className="text-xl font-bold">Create account</h1>
            <p className="mt-1 text-sm text-surface-400">
              Get started with your workspace
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
                Name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                  placeholder="••••••••"
                  minLength={8}
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
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Creating account
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-surface-500">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Sign in
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
