"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { verifyEmail } from "@/lib/auth";
import { useAuth } from "@/contexts/auth-context";
import { AuthPageShell } from "@/components/auth-page-shell";

function VerifyEmailInner() {
  const params = useSearchParams();
  // Also support links sent before the token query format was fixed.
  const token =
    params.get("token") ||
    (params.get("selector") && params.get("verifier")
      ? `${params.get("selector")}.${params.get("verifier")}`
      : "");
  const { refreshUser, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!token || busy || done) return;
    setBusy(true);
    setError("");
    try {
      await verifyEmail(token);
      setDone(true);
      window.history.replaceState(null, "", "/auth/verify-email");
      await refreshUser();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify this address. Request a new link.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell>
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 sm:p-8">
        {done ? (
          <CheckCircle size={28} className="mb-4 text-emerald-400" />
        ) : (
          <Mail size={28} className="mb-4 text-primary-400" />
        )}
        <h1 className="text-xl font-bold">
          {done ? "Email verified" : "Confirm your email"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-surface-400">
          {done
            ? "Your address is verified. You can now access your workspace."
            : token
              ? "Confirm below to finish verifying your Workspace OS account. This link can only be used once."
              : "This link is missing its verification token. Request a new email to continue."}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
        {!done && token && (
          <button
            onClick={() => void confirm()}
            disabled={busy}
            className="gold-accent mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Verifying..." : "Verify my email"}
          </button>
        )}
        <Link
          href={
            done
              ? user?.emailVerifiedAt
                ? "/auth/check-email"
                : "/auth/login"
              : "/auth/request-verification"
          }
          className={`mt-5 block text-center text-sm underline underline-offset-4 ${done || !token ? 'gold-accent-text' : 'text-primary-400'}`}
        >
          {done
            ? user?.emailVerifiedAt
              ? "Continue to workspace"
              : "Sign in"
            : "Request a new verification link"}
        </Link>
      </div>
    </AuthPageShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="p-8 text-center">
          Loading verification...
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
