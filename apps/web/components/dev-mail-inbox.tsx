"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Message = { to: string; subject: string; text: string };

export function DevMailInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<{ messages: Message[] }>("/dev/mail");
      setMessages(result.messages);
    } catch {
      setError(
        "Local inbox unavailable. Start the API in development with DEV_MAIL_INBOX_ENABLED=true and no RESEND_API_KEY, then restart it.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Local verification inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-400">
          Simulated delivery only. No real emails are sent. Opening a captured
          link tests the workflow, not ownership of a real mailbox. Never expose
          this inbox publicly.
        </p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="gold-accent rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh inbox"}
        </button>
        <Link
          href="/auth/register"
          className="py-2 text-sm text-primary-400 underline"
        >
          Create a test account
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {!error && !loading && !messages.length && (
        <p className="text-sm text-surface-400">
          No messages yet. Register an account or request a verification email.
        </p>
      )}
      {messages.map((message, index) => {
        // Links are restricted to this web origin and the two auth destinations.
        const found = message.text.match(/https?:\/\/\S+/)?.[0];
        let link: string | null = null;
        try {
          const url = new URL(found ?? "");
          if (
            url.origin === window.location.origin &&
            ["/auth/verify-email", "/auth/reset-password"].includes(
              url.pathname,
            )
          )
            link = `${url.pathname}${url.search}`;
        } catch {
          /* No actionable local URL. */
        }
        return (
          <article
            key={index}
            className="space-y-3 rounded-xl border border-surface-700 bg-surface-900 p-5"
          >
            <h2 className="font-medium">{message.subject}</h2>
            <p className="break-words text-sm text-surface-400">
              To: {message.to}
            </p>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-surface-300">
              {message.text}
            </pre>
            {link && (
              <Link
                href={link}
                className="inline-block text-sm text-primary-400 underline"
              >
                Open local email link
              </Link>
            )}
          </article>
        );
      })}
    </main>
  );
}
