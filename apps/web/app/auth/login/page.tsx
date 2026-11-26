"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LogIn, Loader2 } from "lucide-react";
import { AuthPageShell } from "@/components/auth-page-shell";
import {
  getRecentProfiles,
  removeRecentProfile,
  type RecentProfile,
} from "@/lib/recent-profiles";
import { getStoredUser, clearSession, getMe } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profiles, setProfiles] = useState(getRecentProfiles());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleProfileClick(p: RecentProfile) {
    const token = localStorage.getItem("accessToken");
    const stored = getStoredUser();
    if (token && stored?.id === p.id) {
      try {
        await getMe();
        router.push("/dashboard");
        return;
      } catch {
        clearSession();
      }
    }
    setEmail(p.email);
    passwordRef.current?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <div className="animate-fadeUp" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-2xl border border-surface-800/50 bg-surface-900 p-6 sm:p-8 shadow-sm shadow-black/10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 shadow-sm shadow-primary-600/10">
              <LogIn size={20} className="text-primary-400" />
            </div>
            <h1 className="text-xl font-bold">Sign in</h1>
            <p className="mt-1 text-sm text-surface-400">
              Access your workspace
            </p>
          </div>

          {mounted && profiles.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-center text-xs font-medium text-surface-500">
                Last login
              </p>
              <div className="flex flex-col items-stretch gap-2">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProfileClick(p)}
                    title={p.email}
                    className="group relative flex w-full items-center gap-2.5 rounded-lg border border-surface-700/60 bg-surface-800/40 px-3 py-2 text-sm transition-colors hover:border-primary-500/50"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-surface-100">
                      {(p.displayName || p.email)[0]?.toUpperCase()}
                    </span>
                    <span className="text-surface-200">
                      {p.displayName || p.email}
                    </span>
                    <span
                      role="button"
                      aria-label={`Remove ${p.displayName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentProfile(p.id);
                        setProfiles(getRecentProfiles());
                      }}
                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-surface-600 text-caption text-surface-100 group-hover:flex"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                ref={emailRef}
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">
                Password
              </label>
              <input
                ref={passwordRef}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="gold-accent w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors action-interaction disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Signing in
                </span>
              ) : (
                "Sign in"
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
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
