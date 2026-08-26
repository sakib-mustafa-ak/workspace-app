'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Archive, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notificationsApi, type Notification } from '@/lib/notifications';
import { SkeletonBlock, SkeletonCircle } from '@/components/skeleton';

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, filter: filter === 'unread' ? 'unread' : undefined });
      setNotifications(res.data || []);
      setTotal(res.total || 0);
    } catch { /* handled */ }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)));
    } catch { /* handled */ }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch { /* handled */ }
  }

  async function handleArchive(id: string) {
    try {
      await notificationsApi.archive(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* handled */ }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-surface-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <Bell size={20} className="text-primary-500" />
          <h1 className="font-display text-lg font-bold">Notifications</h1>
        </div>
        <button onClick={handleMarkAllRead} className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-400 hover:text-white">
          <CheckCheck size={14} />
          Mark all read
        </button>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-surface-800 p-1">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(0); }} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-surface-800 text-white' : 'text-surface-400 hover:text-surface-200'}`}>
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-surface-800 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
              <SkeletonCircle className="h-10 w-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-3/4 rounded" />
                <SkeletonBlock className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16">
          <Bell size={40} className="text-surface-600 mb-3" />
          <p className="text-sm text-surface-400">No notifications</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {notifications.map((n) => (
              <div key={n.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors sm:gap-4 sm:px-5 sm:py-4 ${!n.readAt ? 'border-surface-700 bg-surface-800/40' : 'border-surface-800'}`}>
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? 'bg-primary-500' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-surface-400">{n.body}</p>}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-surface-500">
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
                    <Archive size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
              <button disabled={page <= 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:text-white disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${page === i ? 'bg-surface-800 text-white' : 'text-surface-400 hover:text-surface-200'}`}>
                  {i + 1}
                </button>
              ))}
              <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:text-white disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
