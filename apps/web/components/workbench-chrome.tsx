"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Columns3, Keyboard, LayoutDashboard, LogOut, Moon, Monitor, Puzzle, Search, Settings, ShieldCheck, Sun, Users } from "lucide-react";
import { WorkspaceLogo } from "@/components/workspace-logo";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { notificationsApi } from "@/lib/notifications";
import { WorkbenchSearch } from "@/components/workbench-search";

export function WorkbenchTitleBar({ section, onShortcuts }: { section: string; onShortcuts: () => void }) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-surface-800 bg-workbench-chrome px-3 text-xs text-surface-400">
      <Link href="/dashboard" aria-label="Workspace OS dashboard" className="flex shrink-0 items-center gap-2">
        <WorkspaceLogo className="h-5 w-5" />
        <span className="hidden font-medium sm:inline">Workspace OS</span>
      </Link>
      <div className="flex min-w-0 items-center gap-2 text-surface-500">
        <span className="hidden sm:inline">Workspace OS</span>
        <ChevronRight size={12} aria-hidden="true" className="hidden sm:block" />
        <span className="truncate text-surface-300">{section}</span>
      </div>
      <button type="button" onClick={onShortcuts} aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" className="flex h-7 shrink-0 items-center gap-2 rounded-sm px-2 hover:bg-surface-800 hover:text-surface-200">
        <Keyboard size={15} /><span className="hidden sm:inline">Shortcuts</span>
      </button>
    </header>
  );
}

const activities = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/dashboard/plugins", label: "Plugins", Icon: Puzzle },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/users", label: "People", Icon: Users },
];

export function WorkbenchActivityBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ThemeIcon = theme === 'light' ? Sun : theme === 'system' ? Monitor : Moon;
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void notificationsApi.countUnread().then(({ count }) => { if (active) setUnread(count); }).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return (
    <>
    <nav aria-label="Activity bar" className="hidden w-12 shrink-0 flex-col border-r border-surface-800 bg-workbench-chrome lg:flex">
      <button type="button" aria-label="Search boards and tasks" title="Search boards and tasks" onClick={() => setSearchOpen(true)} className="flex h-12 items-center justify-center text-surface-500 hover:bg-surface-800/30 hover:text-surface-200"><Search size={22} strokeWidth={1.5} /></button>
      {activities.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-label={label === 'Notifications' && unread ? `${label} (${unread} unread)` : label} title={label} aria-current={pathname === href ? "page" : undefined} className={`relative flex h-12 items-center justify-center border-l-2 transition-colors ${pathname === href ? "border-primary-400 bg-surface-800/30 text-surface-100" : "border-transparent text-surface-500 hover:text-surface-200"}`}>
          <Icon size={22} strokeWidth={1.5} />
          {href === '/notifications' && unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] text-white" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
        </Link>
      ))}
      <div className="mt-auto border-t border-surface-800">
        {user?.isAdmin && <Link href="/admin" aria-label="Admin" title="Admin" className="flex h-12 items-center justify-center text-surface-500 hover:text-surface-200"><ShieldCheck size={22} strokeWidth={1.5} /></Link>}
        <button type="button" onClick={toggleTheme} aria-label={`Change color theme (currently ${theme})`} title={`Color theme: ${theme}`} className="flex h-12 w-full items-center justify-center text-surface-500 hover:text-surface-200"><ThemeIcon size={21} strokeWidth={1.5} /></button>
        <Link href="/settings" aria-label="Account settings" title="Account settings" className="flex h-12 items-center justify-center text-surface-500 hover:text-surface-200"><Settings size={22} strokeWidth={1.5} /></Link>
        <button type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="flex h-12 w-full items-center justify-center text-surface-500 hover:text-surface-200"><LogOut size={21} strokeWidth={1.5} /></button>
      </div>
    </nav>
    {searchOpen && <WorkbenchSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

export function WorkbenchStatusBar({ section, onShortcuts }: { section: string; onShortcuts: () => void }) {
  return (
    <div className="hidden h-6 shrink-0 items-center justify-between border-t border-surface-800 bg-workbench-chrome px-3 font-mono text-[10px] text-surface-400 lg:flex">
      <span className="flex items-center gap-2"><Columns3 size={12} className="text-primary-400" />Workspace OS<span className="text-surface-600">/</span>{section}</span>
      <button type="button" onClick={onShortcuts} className="flex h-full items-center gap-2 px-2 hover:bg-surface-800"><Keyboard size={12} />Keyboard shortcuts</button>
    </div>
  );
}
