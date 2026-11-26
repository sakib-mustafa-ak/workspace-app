"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { pluginsApi } from "@/lib/plugins";

export default function PluginCallbackPage() {
  const provider = useParams().provider as string;
  const router = useRouter();
  const read = useRef(false);
  const [pending, setPending] = useState<{
    state: string;
    code: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const params = new URLSearchParams(window.location.search);
    window.history.replaceState(null, "", window.location.pathname);
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(`plugin-oauth:${provider}`) ?? "null",
      );
      if (params.has("error"))
        throw new Error(
          "Permission was not granted. Return to Plugins to try again.",
        );
      if (
        !stored ||
        !["github", "slack", "google-calendar"].includes(provider) ||
        stored.scope !== "account" ||
        stored.state !== params.get("state") ||
        Date.now() - stored.createdAt > 10 * 60_000 ||
        !params.get("code")
      )
        throw new Error(
          "This connection request is missing or expired. Start again from Plugins in the same browser tab.",
        );
      setPending({
        state: stored.state,
        code: params.get("code")!,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid connection request.",
      );
    }
  }, [provider]);
  async function complete() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    try {
      await pluginsApi.complete(provider, pending.state, pending.code);
      sessionStorage.removeItem(`plugin-oauth:${provider}`);
      router.replace("/dashboard/plugins");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connection failed. Start again from Plugins.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-6 sm:p-10">
      <h1 className="text-xl font-semibold">
        Finish connecting{" "}
        {provider === "google-calendar"
          ? "Google Calendar"
          : provider === "github"
            ? "GitHub"
            : provider === "slack"
              ? "Slack"
              : "integration"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-surface-400">
        Confirm to save the connection to your account for use across all your
        workspaces. Your provider credentials stay on the server.
      </p>
      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}
      {pending && (
        <button
          disabled={busy}
          onClick={() => void complete()}
          className="gold-accent mt-6 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Finish connection"}
        </button>
      )}
      <Link
        href={"/dashboard/plugins"}
        className={`mt-5 block text-sm ${pending ? 'text-surface-400' : 'gold-accent-text'}`}
      >
        {pending ? "Back to Plugins" : "Back to dashboard"}
      </Link>
    </div>
  );
}
