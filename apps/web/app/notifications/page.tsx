'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notificationsApi, type Notification } from '@/lib/notifications';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi.list({ limit: 50 }).then(setNotifications).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleMarkRead(id: string) {
    await notificationsApi.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)));
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  async function handleArchive(id: string) {
    await notificationsApi.archive(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-surface-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <Bell size={20} className="text-primary-500" />
          <h1 className="text-lg font-bold">Notifications</h1>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-400 hover:text-white"
        >
          <CheckCheck size={14} />
          Mark all read
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16">
          <Bell size={40} className="text-surface-600 mb-3" />
          <p className="text-sm text-surface-400">No notifications</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 rounded-lg border border-surface-800 px-5 py-4 transition-colors ${
                !n.readAt ? 'bg-surface-800/40 border-surface-700' : ''
              }`}
            >
              <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                !n.readAt ? 'bg-primary-500' : 'bg-transparent'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-surface-400">{n.body}</p>}
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-surface-500">
                  <span>{n.type}</span>
                  <span>&middot;</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!n.readAt && (
                  <button onClick={() => handleMarkRead(n.id)} className="rounded p-1.5 text-surface-500 hover:text-surface-300 hover:bg-surface-800" title="Mark read">
                    <CheckCheck size={14} />
                  </button>
                )}
                <button onClick={() => handleArchive(n.id)} className="rounded p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-800" title="Archive">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
