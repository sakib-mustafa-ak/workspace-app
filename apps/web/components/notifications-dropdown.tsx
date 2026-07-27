'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { notificationsApi, type Notification } from '@/lib/notifications';

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    notificationsApi.countUnread().then((r) => setUnreadCount(r.count)).catch(() => {});
    notificationsApi.list({ limit: 20 }).then(setNotifications).catch(() => {});
  }, [open]);

  async function handleMarkAllRead() {
    await notificationsApi.markAllAsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  async function handleMarkRead(id: string) {
    await notificationsApi.markAsRead(id);
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)));
  }

  async function handleArchive(id: string) {
    await notificationsApi.archive(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-surface-800 bg-surface-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
            <h3 className="text-sm font-medium">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-xs text-surface-500">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-surface-800 px-4 py-3 ${
                    !n.readAt ? 'bg-surface-800/50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[11px] text-surface-400 truncate">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-surface-500">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.readAt && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="rounded p-1 text-surface-500 hover:text-surface-300"
                        title="Mark read"
                      >
                        <CheckCheck size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => handleArchive(n.id)}
                      className="rounded p-1 text-surface-500 hover:text-red-400"
                      title="Archive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
