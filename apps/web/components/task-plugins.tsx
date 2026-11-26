"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, ThumbsUp } from "lucide-react";
import { pluginsApi, type TaskPluginStatus } from "@/lib/plugins";

export function TaskPlugins({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) {
  const [status, setStatus] = useState<TaskPluginStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setStatus(await pluginsApi.task(workspaceId, taskId));
  }, [workspaceId, taskId]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await pluginsApi.task(workspaceId, taskId);
        if (active) {
          setStatus(next);
          setError("");
        }
      } catch {
        if (active) setError("Could not load task plugins.");
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workspaceId, taskId]);
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plugin action failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!status && !error) return null;
  if (status && !status.voting && !status.tracking && !error) return null;
  const running = status?.runningTaskId === taskId;
  return (
    <section
      aria-label="Task plugins"
      className="space-y-3 rounded-lg border border-surface-700 p-3 text-xs"
    >
      <p className="font-medium text-surface-400">Plugins</p>
      {status?.voting && (
        <button
          type="button"
          disabled={busy}
          aria-pressed={status.voted}
          onClick={() =>
            void act(() => pluginsApi.vote(workspaceId, taskId, !status.voted))
          }
          className={`flex items-center gap-2 rounded-md border px-3 py-2 ${status.voted ? "border-primary-500 text-primary-400" : "border-surface-700 text-surface-300"}`}
        >
          <ThumbsUp size={14} />
          {status.votes} {status.votes === 1 ? "vote" : "votes"} ·{" "}
          {status.voted ? "Remove your vote" : "Vote"}
        </button>
      )}
      {status?.tracking && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-surface-400">
            <Clock3 size={14} />
            Your time: {Math.floor(status.seconds / 3600)}h{" "}
            {Math.floor(status.seconds / 60) % 60}m {running && "· Running"}
          </span>
          {status.canTrack && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  status.runningTaskId
                    ? pluginsApi.stop(workspaceId)
                    : pluginsApi.start(workspaceId, taskId),
                )
              }
              className="rounded-md border border-surface-700 px-3 py-2 text-surface-300"
            >
              {running
                ? "Stop timer"
                : status.runningTaskId
                  ? "Stop other timer"
                  : "Start timer"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
