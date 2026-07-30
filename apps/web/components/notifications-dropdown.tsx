'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { notificationsApi, type Notification } from '@/lib/notifications';

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function poll() {
      notificationsApi.list({ filter: 'unread', limit: 10 })
        .then((res) => setNotifications(res.data || []))
        .catch(() => {});
      notificationsApi.countUnread()
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-surface-400 hover:text-surface-200 transition-colors">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
            <span className="text-sm font-medium text-surface-200">Notifications</span>
            <Link href="/notifications" className="text-xs text-primary-400 hover:text-primary-300" onClick={() => setOpen(false)}>View all</Link>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-xs text-surface-500">No new notifications</p>
            ) : (
              notifications.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 border-b border-surface-800/50 px-4 py-3 transition-colors hover:bg-surface-800/50 ${!item.readAt ? '' : ''}`}
                >
                  {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                  {item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-surface-200">{item.title}</p>
                    {item.body && <p className="mt-0.5 text-[11px] text-surface-500 line-clamp-2">{item.body}</p>}
                    <p className="mt-0.5 text-[10px] text-surface-600">{new Date(item.createdAt).toLocaleDateString()}</p>
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
