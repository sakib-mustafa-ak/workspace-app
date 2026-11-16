"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { requestVerification } from "@/lib/auth";
import { workspacesApi } from "@/lib/workspaces";
import { AuthPageShell } from "@/components/auth-page-shell";

export default function CheckEmailPage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!user?.emailVerifiedAt) return;
    let active = true;
    workspacesApi
      .list()
      .then((workspaces) => {
        if (active)
          router.replace(workspaces.length ? "/dashboard" : "/onboarding");
      })
      .catch(() => {
        if (active) router.replace("/dashboard");
      });
    return () => {
      active = false;
    };
  }, [user, router]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (!user || busy || cooldown) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await requestVerification(user.email);
      setMessage(
        "If your account still needs verification, a new link is on its way. Check your spam folder too.",
      );
      setCooldown(60);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send email. Try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell>
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 sm:p-8">
        <Mail size={28} className="mb-4 text-primary-400" />
        <h1 className="text-xl font-bold">Verify your email</h1>
        <p className="mt-3 break-words text-sm leading-relaxed text-surface-400">
          Open the verification email
          {user ? (
            <>
              {" "}
              for{" "}
              <span className="font-medium text-surface-200">{user.email}</span>
            </>
          ) : (
            ""
          )}
          , then confirm your address to access your workspace. The link expires
          after 24 hours.
        </p>
        {message && (
          <p role="status" className="mt-4 text-sm text-emerald-400">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="mt-4 text-sm">
            Loading your account...
          </p>
        ) : user ? (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => void resend()}
              disabled={busy || cooldown > 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {cooldown
                ? `Resend in ${cooldown}s`
                : "Resend verification email"}
            </button>
            <button
              onClick={async () => {
                setBusy(true);
                await refreshUser();
                setBusy(false);
                setMessage(
                  "If you have verified your address, you will continue automatically. Otherwise, open the link in your inbox.",
                );
              }}
              disabled={busy}
              className="w-full rounded-lg border border-surface-700 px-4 py-2.5 text-sm disabled:opacity-50"
            >
              I’ve verified my email
            </button>
            <button
              onClick={() => void logout()}
              className="w-full py-2 text-sm text-surface-400 underline underline-offset-4"
            >
              Use a different account
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3 text-sm">
            <Link href="/auth/login" className="text-primary-400 underline">
              Sign in to continue
            </Link>
            <Link
              href="/auth/request-verification"
              className="text-surface-400 underline"
            >
              Request a new verification link
            </Link>
          </div>
        )}
      </div>
    </AuthPageShell>
  );
}
