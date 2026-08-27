'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';
import { notificationsApi } from '@/lib/notifications';
import { WorkspaceLogo } from '@/components/workspace-logo';
import {
  LayoutDashboard,
  Settings,
  Bell,
  Users,
  LogOut,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Search,
  Plus,
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
  const { theme, setTheme } = useTheme();

  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceBoards, setWorkspaceBoards] = useState<Record<string, Board[]>>({});
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Sync activeWorkspaceId from URL
  useEffect(() => {
    const match = pathname.match(/^\/workspaces\/([^/]+)/);
    if (match && match[1]) {
      setActiveWorkspaceId(match[1]);
    }
  }, [pathname]);

  // Load workspaces on mount
  useEffect(() => {
    workspacesApi.list().then(setUserWorkspaces).catch(() => {});
  }, []);

  // Load boards for active workspace
  useEffect(() => {
    if (activeWorkspaceId && !workspaceBoards[activeWorkspaceId]) {
      boardsApi.list(activeWorkspaceId)
        .then((boards) => setWorkspaceBoards((prev) => ({ ...prev, [activeWorkspaceId]: boards })))
        .catch(() => {});
    }
  }, [activeWorkspaceId, workspaceBoards]);

  // Search debounce
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

  // Click outside to close search
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Click outside to close switcher
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Poll unread notification count
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      notificationsApi.countUnread()
        .then((res) => { if (!cancelled) setUnreadCount(res.count); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const activeWorkspace = userWorkspaces.find((w) => w.id === activeWorkspaceId);
  const activeBoards = activeWorkspaceId ? workspaceBoards[activeWorkspaceId] || [] : [];

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-surface-800 bg-gradient-to-b from-surface-900 to-surface-900/95">
      <div className="flex h-14 items-center border-b border-surface-800 px-4">
        <div className="flex items-center gap-2.5">
          <WorkspaceLogo className="h-7 w-7" />
          <span className="font-display text-sm font-semibold tracking-tight">Workspace OS</span>
        </div>
      </div>

      <div ref={searchRef} className="relative px-3 pb-3">
        <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-500" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-lg border border-surface-700/60 bg-surface-800/40 pt-[5px] pb-[7px] pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-surface-500 hover:border-surface-700 focus:border-primary-500/50 mt-3"
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
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {searchResults.tasks?.map((t: any) => (
              <Link key={t.id} href={`/workspaces/${t.workspaceId}/boards/${t.boardId}`}
                className="flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-800">
                <span className="text-surface-600">·</span>
                {t.title}
              </Link>
            ))}
            {(!searchResults.boards || searchResults.boards.length === 0) &&
              (!searchResults.tasks || searchResults.tasks.length === 0) && (
              <p className="px-3 py-4 text-center text-xs text-surface-500">No results</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className="space-y-1 p-3">
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
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-caption font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {userWorkspaces.length > 0 && (
          <div className="px-3 pt-2">
            <p className="mb-2 px-3 text-label text-surface-500">Workspaces</p>
            <div ref={switcherRef} className="relative">
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-200 hover:bg-surface-800/50"
              >
                <WorkspaceLogo className="h-5 w-5" name={activeWorkspace?.name ?? 'Select'} />
                <span className="flex-1 truncate text-left">{activeWorkspace?.name ?? 'Select workspace'}</span>
                <ChevronDown size={14} className={`text-surface-500 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
              </button>

              {switcherOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-surface-800/50 bg-surface-900 p-1 shadow-xl">
                  {userWorkspaces.map((ws) => (
                    <Link
                      key={ws.id}
                      href={`/workspaces/${ws.id}`}
                      onClick={() => setSwitcherOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        ws.id === activeWorkspaceId
                          ? 'bg-surface-800 text-white'
                          : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
                      }`}
                    >
                      <WorkspaceLogo className="h-5 w-5" name={ws.name} />
                      <span className="flex-1 truncate">{ws.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-surface-600">{ws.memberCount} members</span>
                    </Link>
                  ))}
                  <Link
                    href="/workspaces"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-surface-800/50 hover:text-surface-200"
                  >
                    <Plus size={14} />
                    <span>All workspaces</span>
                  </Link>
                </div>
              )}
            </div>

            {activeWorkspaceId && activeBoards.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="mb-2 px-3 text-label text-surface-500">Boards</p>
                <Link
                  href={`/workspaces/${activeWorkspaceId}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-surface-400 hover:bg-surface-800/50 hover:text-surface-200"
                >
                  <div className="h-1 w-1 rounded-full bg-surface-500" />
                  All boards
                </Link>
                {activeBoards.map((board) => {
                  const boardActive = pathname === `/workspaces/${activeWorkspaceId}/boards/${board.id}`;
                  return (
                    <Link
                      key={board.id}
                      href={`/workspaces/${activeWorkspaceId}/boards/${board.id}`}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                        boardActive
                          ? 'bg-surface-800 text-white'
                          : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
                      }`}
                    >
                      <div className="h-1 w-1 rounded-full bg-surface-500" />
                      <span className="truncate">{board.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-surface-800 p-3">
        <Link
          href="/settings"
          className="group mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-surface-800/50"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-surface-600 to-surface-700 text-xs font-medium text-surface-200 shadow-sm">
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-warm-300">
              {user?.displayName || 'User'}
            </p>
            <p className="hidden truncate text-xs text-surface-500 group-hover:block">{user?.email}</p>
          </div>
          <ChevronRight size={14} className="text-surface-600" />
        </Link>
        <div role="group" aria-label="Theme" className="flex items-center justify-between gap-1 px-1">
          <button
            onClick={() => setTheme('dark')}
            title="Dark"
            aria-label="Dark"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${theme === 'dark' ? 'text-primary-400' : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'}`}
          >
            <Moon size={15} />
          </button>
          <button
            onClick={() => setTheme('light')}
            title="Light"
            aria-label="Light"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${theme === 'light' ? 'text-primary-400' : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'}`}
          >
            <Sun size={15} />
          </button>
          <button
            onClick={() => setTheme('system')}
            title="System"
            aria-label="System"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${theme === 'system' ? 'text-primary-400' : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'}`}
          >
            <Monitor size={15} />
          </button>
        </div>
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