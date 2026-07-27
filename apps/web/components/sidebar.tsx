'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { NotificationsDropdown } from '@/components/notifications-dropdown';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-60 flex-col border-r border-surface-800 bg-surface-900">
      <div className="flex h-14 items-center justify-between border-b border-surface-800 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-xs font-bold text-white">
            W
          </div>
          <span className="text-sm font-semibold">Workspace OS</span>
        </div>
        <NotificationsDropdown />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-surface-800 text-white'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-800 p-3">
        <div className="mb-2 flex items-center gap-2.5 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-700 text-xs font-medium">
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.displayName || 'User'}
            </p>
            <p className="truncate text-xs text-surface-500">{user?.email}</p>
          </div>
          <ChevronRight size={14} className="text-surface-500" />
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
