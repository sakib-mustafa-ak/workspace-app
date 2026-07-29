'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
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
  Search,
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

  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSearchResults(res as any);
        setSearchOpen(true);
      } catch { /* handled */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    workspacesApi.list().then(setUserWorkspaces).catch(() => {});
  }, []);

  useEffect(() => {
    function poll() {
      api.get<{count: number}>('/notifications/count').then((r) => {
        if (typeof r === 'object' && r !== null && 'count' in r) {
          setUnreadCount((r as {count: number}).count);
        }
      }).catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

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

      <div ref={searchRef} className="relative px-3 pb-2">
        <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-500" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-lg border border-surface-800 bg-surface-950 py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-surface-600 focus:border-primary-500/50"
        />
        {searchOpen && searchResults && (
          <div className="absolute left-3 right-3 top-full mt-1 rounded-xl border border-surface-800 bg-surface-900 shadow-xl z-50 max-h-64 overflow-y-auto">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {searchResults.boards?.map((b: any) => (
              <Link key={b.id} href={`/workspaces/${b.workspaceId}/boards/${b.id}`}
                className="flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-800">
                {b.title}
              </Link>
            ))}
            {(!searchResults.boards || searchResults.boards.length === 0) && (
              <p className="px-3 py-4 text-center text-xs text-surface-500">No results</p>
            )}
          </div>
        )}
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
              <span className="flex-1">{item.label}</span>
              {item.href === '/notifications' && unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {userWorkspaces.length > 0 && (
        <div className="px-3 pt-2">
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-surface-500">Workspaces</p>
          {userWorkspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith(`/workspaces/${ws.id}`)
                  ? 'bg-surface-800 text-white'
                  : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
              }`}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-surface-700 text-[9px] font-bold text-surface-300">
                {ws.name.charAt(0).toUpperCase()}
              </div>
              {ws.name}
            </Link>
          ))}
        </div>
      )}

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
