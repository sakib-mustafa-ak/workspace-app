"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  GitBranch,
  Loader2,
  MessageSquare,
  Puzzle,
  RefreshCw,
  ThumbsUp,
} from "lucide-react";
import {
  pluginsApi,
  type Plugin,
  type PluginCatalog,
  type PluginItem,
  type TimeEntry,
} from "@/lib/plugins";
import { ConfirmModal } from "@/components/confirm-modal";

const icons = {
  "time-tracking": Clock3,
  "task-voting": ThumbsUp,
  github: GitBranch,
  slack: MessageSquare,
  "google-calendar": CalendarDays,
  "custom-extensions": Puzzle,
};
const buttonClass =
  "rounded-lg border border-surface-700 px-3 py-2 text-xs font-medium text-surface-300 hover:bg-surface-800 disabled:cursor-not-allowed disabled:opacity-40";
const inputClass =
  "w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-200";

function safeLink(value?: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function IntegrationTools({ plugin }: { plugin: Plugin }) {
  const [items, setItems] = useState<PluginItem[]>([]);
  const [repository, setRepository] = useState("");
  const [channel, setChannel] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load(repo?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setItems(await pluginsApi.data(plugin.key, repo));
      setRepository(repo ?? "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load provider data.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await pluginsApi.send(channel, text.trim());
      setText("");
      setMessage("Message sent to Slack.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3 border-t border-surface-800 pt-4">
      <p className="text-xs leading-relaxed text-surface-500">
        Only you can open data from this connection. Nothing is imported
        automatically.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => void load()}
          className={buttonClass}
        >
          {busy
            ? "Loading…"
            : plugin.key === "github"
              ? "Load public repositories"
              : plugin.key === "slack"
                ? "Load public channels"
                : "Load upcoming events"}
        </button>
        {repository && (
          <span className="self-center text-xs text-surface-400">
            Issues in {repository}
          </span>
        )}
      </div>
      {plugin.key === "slack" ? (
        <form onSubmit={(event) => void send(event)} className="space-y-3">
          <label className="block text-xs text-surface-400">
            Channel
            <select
              required
              disabled={busy}
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Select a channel</option>
              {items.map((item) => (
                <option key={item.id} value={item.id} disabled={!item.canSend}>
                  {item.title}
                  {!item.canSend && " — invite bot first"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-surface-400">
            Message
            <textarea
              required
              maxLength={3000}
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Write the message you want to send"
            />
          </label>
          <button
            disabled={busy || !channel || !text.trim()}
            className={buttonClass}
          >
            Send to Slack
          </button>
        </form>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-auto">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg bg-surface-950 p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-surface-300">{item.title}</p>
                  {item.startsAt && (
                    <p className="mt-1 text-surface-500">
                      {item.startsAt.length === 10
                        ? item.startsAt + " · All day"
                        : new Date(item.startsAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {safeLink(item.url) && (
                  <a
                    href={safeLink(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${item.title}`}
                    className="shrink-0 text-surface-400"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              {plugin.key === "github" && !repository && (
                <button
                  disabled={busy}
                  onClick={() => void load(item.title)}
                  className="mt-2 text-primary-400"
                >
                  View open issues
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!busy && items.length === 0 && (
        <p className="text-xs text-surface-500">
          Load data above. Results are limited to 30 repositories/issues/events
          or 100 channels.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-emerald-400">
          {message}
        </p>
      )}
    </div>
  );
}

export function AccountPlugins() {
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("all");
  const [confirm, setConfirm] = useState<Plugin | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [time, setTime] = useState<TimeEntry[]>([]);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [next, entries] = await Promise.all([
        pluginsApi.list(),
        pluginsApi.time(),
      ]);
      setCatalog(next);
      setTime(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plugins.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  async function change(plugin: Plugin) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (plugin.category === "integration" && !plugin.connected) {
        const result = await pluginsApi.connect(plugin.key);
        sessionStorage.setItem(
          `plugin-oauth:${plugin.key}`,
          JSON.stringify({
            scope: "account",
            state: result.state,
            createdAt: Date.now(),
          }),
        );
        window.location.assign(result.url);
      } else {
        await pluginsApi.set(plugin.key, !plugin.enabled);
        setOpen(null);
        setConfirm(null);
        await reload();
      }
    } catch (err) {
      setConfirm(null);
      setError(err instanceof Error ? err.message : "Could not update plugin.");
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    setBusy(true);
    setError("");
    try {
      await pluginsApi.stop();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop timer.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-5 sm:p-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-xs text-surface-400"
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Plugins</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-surface-500">
            Enable or connect once for all your workspaces. Connections are
            private to your account; workspace and board permissions still
            apply.
          </p>
        </div>
        <button
          aria-label="Refresh plugins"
          disabled={loading || busy}
          onClick={() => void reload()}
          className={buttonClass}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </header>
      {catalog && !catalog.canManage && (
        <p className="mb-5 rounded-lg border border-surface-800 p-3 text-xs text-surface-400">
          Manage your personal plugins here. Enabled add-ons are available
          inside tasks.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-500/30 p-3 text-sm text-red-400"
        >
          {error}
        </p>
      )}
      {time.some((entry) => !entry.endedAt) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-700 p-4">
          <span className="text-sm text-surface-300">
            You have a running task timer.
          </span>
          <button
            disabled={busy}
            onClick={() => void stop()}
            className={buttonClass}
          >
            Stop my timer
          </button>
        </div>
      )}
      <nav aria-label="Plugin categories" className="mb-6 flex flex-wrap gap-2">
        {[
          ["all", "All plugins"],
          ["addon", "Add-ons"],
          ["integration", "Integrations"],
          ["custom", "Custom extensions"],
        ].map(([value, title]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value!)}
            className={`${buttonClass} ${tab === value ? "bg-surface-800" : ""}`}
          >
            {title}
          </button>
        ))}
      </nav>
      {loading && !catalog ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-surface-400"
        >
          <Loader2 size={16} className="animate-spin" />
          Loading plugins…
        </p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {catalog?.plugins
            .filter((plugin) => tab === "all" || tab === plugin.category)
            .map((plugin) => {
              const Icon = icons[plugin.key as keyof typeof icons] ?? Puzzle;
              return (
                <article
                  key={plugin.key}
                  className="rounded-xl border border-surface-800 bg-surface-900/40 p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg border border-surface-700 p-2 text-surface-400">
                        <Icon size={20} />
                      </span>
                      <h2 className="text-sm font-semibold">{plugin.name}</h2>
                    </div>
                    <span
                      className={`rounded-full border border-surface-700 px-2 py-1 text-[10px] ${plugin.enabled ? "text-emerald-400" : "text-surface-500"}`}
                    >
                      {plugin.comingSoon
                        ? "Coming soon"
                        : plugin.connected
                          ? "Connected"
                          : plugin.enabled
                            ? "Enabled"
                            : "Not enabled"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-surface-400">
                    {plugin.description}
                  </p>
                  {plugin.permissions.length > 0 && (
                    <details className="mt-4 text-xs text-surface-500">
                      <summary className="cursor-pointer">Permissions</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-4">
                        {plugin.permissions.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {!plugin.available &&
                    !plugin.comingSoon &&
                    catalog.canManage && (
                      <div className="mt-4 rounded-lg bg-surface-950 p-3 text-xs leading-relaxed text-surface-500">
                        <p>
                          Server setup required. Add these on Render, never in
                          browser settings:
                        </p>
                        <ul className="mt-2 space-y-1 break-all font-mono">
                          {[
                            "PLUGIN_TOKEN_ENCRYPTION_KEY",
                            ...(plugin.setupKeys ?? []),
                          ].map((key) => (
                            <li key={key}>{key}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      disabled={
                        busy ||
                        !catalog.canManage ||
                        (!plugin.available && !plugin.enabled) ||
                        plugin.comingSoon
                      }
                      onClick={() => setConfirm(plugin)}
                      className={buttonClass}
                    >
                      {plugin.comingSoon
                        ? "Coming soon"
                        : plugin.category === "integration"
                          ? plugin.connected
                            ? "Disconnect"
                            : "Connect"
                          : plugin.enabled
                            ? "Disable"
                            : "Enable"}
                    </button>
                    {plugin.enabled && plugin.ownedConnection && (
                      <button
                        onClick={() =>
                          setOpen(open === plugin.key ? null : plugin.key)
                        }
                        aria-expanded={open === plugin.key}
                        className={buttonClass}
                      >
                        {open === plugin.key ? "Close tools" : "Open tools"}
                      </button>
                    )}
                  </div>
                  {plugin.key === "time-tracking" && plugin.enabled && (
                    <p className="mt-3 text-xs text-surface-500">
                      Open a task to start a timer. One running timer per person
                      in each workspace.
                    </p>
                  )}
                  {open === plugin.key &&
                    plugin.enabled &&
                    plugin.ownedConnection && (
                      <IntegrationTools plugin={plugin} />
                    )}
                </article>
              );
            })}
        </div>
      )}
      <ConfirmModal
        open={Boolean(confirm)}
        title={
          confirm
            ? `${confirm.enabled ? (confirm.category === "integration" ? "Disconnect" : "Disable") : confirm.category === "integration" ? "Connect" : "Enable"} ${confirm.name}?`
            : ""
        }
        description={
          confirm?.category === "integration"
            ? confirm.connected
              ? "Remove the saved credentials from Workspace OS. Also revoke access in the provider settings if you no longer want this app authorized."
              : "You will be taken to the provider to review permissions. Data is visible only to you across your workspaces. No tasks or messages are sent automatically."
            : confirm?.enabled
              ? "Hide this add-on from your tasks in all workspaces. Recorded time and votes are kept. Disabling time tracking stops your running timers."
              : "Make this add-on available to you on accessible tasks across all your workspaces."
        }
        confirmLabel={
          confirm?.enabled
            ? confirm.category === "integration"
              ? "Disconnect"
              : "Disable"
            : confirm?.category === "integration"
              ? "Continue to provider"
              : "Enable"
        }
        loading={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          if (confirm) void change(confirm);
        }}
      />
    </div>
  );
}
