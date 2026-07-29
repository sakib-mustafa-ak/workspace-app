'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  LayoutDashboard,
  Settings,
  Bell,
  Users,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';


const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex w-60 flex-shrink-0 flex-col border-r border-surface-800 bg-gradient-to-b from-surface-900 to-surface-900/95">
      <div className="flex h-14 items-center border-b border-surface-800 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white shadow-sm shadow-primary-600/30">
            W
          </div>
          <span className="text-sm font-semibold tracking-tight">Workspace OS</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                active
                  ? 'bg-surface-800 text-white shadow-sm'
                  : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
              }`}
            >
              <item.icon size={16} className={active ? 'text-primary-400' : ''} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-800 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-surface-800/50">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-surface-600 to-surface-700 text-xs font-medium text-surface-200 shadow-sm">
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-surface-200">
              {user?.displayName || 'User'}
            </p>
            <p className="truncate text-xs text-surface-500">{user?.email}</p>
          </div>
          <ChevronRight size={14} className="text-surface-600" />
        </div>
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-400 transition-all hover:bg-surface-800/50 hover:text-surface-200"
        >
          {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
          {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-surface-400 transition-all hover:bg-surface-800/50 hover:text-surface-200"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
