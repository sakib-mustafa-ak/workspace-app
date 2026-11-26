"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Columns3,
  ExternalLink,
  RefreshCw,
  SquarePen,
  X,
} from "lucide-react";
import { notificationsApi, type Notification } from "@/lib/notifications";

export function WorkbenchQuickAccess({
  pathname,
  label,
  onClose,
}: {
  pathname: string;
  label: string;
  onClose: () => void;
}) {
  const workspace = pathname.match(/^\/workspaces\/([^/]+)/)?.[1];
  const board = pathname.match(/^\/workspaces\/([^/]+)\/boards\/([^/]+)/);
  return (
    <aside
      aria-label="Secondary sidebar"
      className="flex h-full min-h-0 flex-col bg-workbench-chrome"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-surface-800 px-3 text-[11px] uppercase tracking-wider text-surface-400">
        Quick access
        <button
          type="button"
          aria-label="Hide secondary sidebar"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center"
        >
          <X size={13} />
        </button>
      </div>
      <div className="overflow-auto p-3 text-xs text-surface-400">
        <p className="mb-4 break-words font-medium text-surface-200">{label}</p>
        {workspace && (
          <Link
            href={`/workspaces/${workspace}`}
            className="flex items-center gap-2 py-2 hover:text-primary-400"
          >
            <Columns3 size={14} />
            Workspace home
          </Link>
        )}
        {board && (
          <>
            <Link
              href={`/workspaces/${board[1]}/boards/${board[2]}`}
              className="flex items-center gap-2 py-2 hover:text-primary-400"
            >
              <Columns3 size={14} />
              Board
            </Link>
            <Link
              href={`/workspaces/${board[1]}/boards/${board[2]}/canvas`}
              className="flex items-center gap-2 py-2 hover:text-primary-400"
            >
              <SquarePen size={14} />
              Canvas
            </Link>
          </>
        )}
        <Link
          href="/dashboard/plugins"
          className="flex items-center gap-2 py-2 hover:text-primary-400"
        >
          <ExternalLink size={14} />
          Account plugins
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 py-2 hover:text-primary-400"
        >
          <ExternalLink size={14} />
          Account settings
        </Link>
        <div className="mt-6 flex gap-4 border-t border-surface-800 pt-3 text-surface-500">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
        </div>
      </div>
    </aside>
  );
}

export function WorkbenchNotifications({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    setItems(null);
    notificationsApi
      .list({ limit: 20 })
      .then((result) => {
        if (active) setItems(result.data);
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [version]);
  return (
    <section
      aria-label="Bottom notifications panel"
      className="flex h-full min-h-0 flex-col bg-workbench-chrome"
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-surface-800 px-3 text-xs text-surface-400">
        <span className="flex items-center gap-2">
          <Bell size={13} />
          Notifications
        </span>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Refresh panel notifications"
            onClick={() => setVersion(version + 1)}
            className="flex h-7 w-7 items-center justify-center"
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            aria-label="Hide bottom panel"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center"
          >
            <X size={13} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto text-xs">
        {!items ? (
          <p role="status" className="p-4 text-surface-500">
            Loading notifications…
          </p>
        ) : error ? (
          <p role="alert" className="p-4 text-red-400">
            Could not load notifications. Use Refresh to retry.
          </p>
        ) : items.length === 0 ? (
          <p className="p-4 text-surface-500">No notifications yet.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href="/notifications"
                  className="flex items-start gap-3 border-b border-surface-800 px-4 py-2 hover:bg-surface-800/40"
                >
                  <Bell
                    size={12}
                    className={`mt-0.5 shrink-0 ${item.readAt ? "text-surface-500" : "text-primary-400"}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-surface-300">{item.title}</p>
                    {item.body && (
                      <p className="mt-1 line-clamp-1 text-surface-500">
                        {item.body}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
