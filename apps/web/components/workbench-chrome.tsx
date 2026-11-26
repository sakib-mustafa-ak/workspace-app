"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Columns3,
  FolderTree,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Moon,
  Monitor,
  Puzzle,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { WorkspaceLogo } from "@/components/workspace-logo";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { notificationsApi } from "@/lib/notifications";
import { WorkbenchSearch } from "@/components/workbench-search";

export function WorkbenchTitleBar({
  section,
  onShortcuts,
  controls,
}: {
  section: string;
  onShortcuts: () => void;
  controls?: ReactNode;
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-surface-800 bg-workbench-chrome px-3 text-xs text-surface-400">
      <Link
        href="/dashboard"
        aria-label="Workspace OS dashboard"
        className="flex shrink-0 items-center gap-2"
      >
        <WorkspaceLogo className="h-5 w-5" />
        <span className="hidden font-medium sm:inline">Workspace OS</span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-surface-500">
        <span className="hidden sm:inline">Workspace OS</span>
        <ChevronRight
          size={12}
          aria-hidden="true"
          className="hidden sm:block"
        />
        <span className="truncate text-surface-300">{section}</span>
      </div>
      <button
        type="button"
        onClick={onShortcuts}
        aria-label="Open keyboard shortcuts"
        title="Keyboard shortcuts"
        className="hidden h-7 shrink-0 items-center gap-2 rounded-sm px-2 hover:bg-surface-800 hover:text-surface-200 sm:flex"
      >
        <Keyboard size={15} />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>
      {controls}
    </header>
  );
}

const activities = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/dashboard/plugins", label: "Plugins", Icon: Puzzle },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/users", label: "People", Icon: Users },
];

export function WorkbenchActivityBar({
  expanded = false,
  onExplorer,
  explorerOpen = false,
}: {
  expanded?: boolean;
  onExplorer?: () => void;
  explorerOpen?: boolean;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ThemeIcon =
    theme === "light" ? Sun : theme === "system" ? Monitor : Moon;
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void notificationsApi
        .countUnread()
        .then(({ count }) => {
          if (active) setUnread(count);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <>
      <nav
        aria-label="Activity bar"
        data-expanded={expanded}
        className={`workbench-activity flex w-12 shrink-0 flex-col overflow-y-auto border-r border-surface-800 bg-workbench-chrome ${expanded ? "lg:w-44" : ""}`}
      >
        {onExplorer && (
          <button
            type="button"
            aria-label="Workspace Explorer"
            aria-pressed={explorerOpen}
            title="Workspace Explorer"
            onClick={onExplorer}
            className="workbench-activity-item flex h-12 shrink-0 items-center justify-center gap-3 text-surface-500 hover:bg-surface-800/30 hover:text-surface-200"
          >
            <FolderTree size={22} strokeWidth={1.5} />
            <span className="workbench-activity-label">Explorer</span>
          </button>
        )}
        <button
          type="button"
          aria-label="Search boards and tasks"
          title="Search boards and tasks"
          onClick={() => setSearchOpen(true)}
          className="workbench-activity-item flex h-12 shrink-0 items-center justify-center gap-3 text-surface-500 hover:bg-surface-800/30 hover:text-surface-200"
        >
          <Search size={22} strokeWidth={1.5} />
          <span className="workbench-activity-label">Search</span>
        </button>
        {activities.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={
              label === "Notifications" && unread
                ? `${label} (${unread} unread)`
                : label
            }
            title={label}
            aria-current={
              pathname === href ||
              (href === "/users" && pathname.startsWith("/users/"))
                ? "page"
                : undefined
            }
            className={`workbench-activity-item relative flex h-12 shrink-0 items-center justify-center gap-3 border-l-2 transition-colors ${pathname === href || (href === "/users" && pathname.startsWith("/users/")) ? "border-primary-400 bg-surface-800/30 text-surface-100" : "border-transparent text-surface-500 hover:text-surface-200"}`}
          >
            <Icon size={22} strokeWidth={1.5} />
            <span className="workbench-activity-label">{label}</span>
            {href === "/notifications" && unread > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] text-white"
                aria-hidden="true"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        ))}
        <div className="mt-auto border-t border-surface-800">
          {user?.isAdmin && (
            <Link
              href="/admin"
              aria-label="Admin"
              title="Admin"
              className="workbench-activity-item flex h-12 items-center justify-center gap-3 text-surface-500 hover:text-surface-200"
            >
              <ShieldCheck size={22} strokeWidth={1.5} />
              <span className="workbench-activity-label">Admin</span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Change color theme (currently ${theme})`}
            title={`Color theme: ${theme}`}
            className="workbench-activity-item flex h-12 w-full items-center justify-center gap-3 text-surface-500 hover:text-surface-200"
          >
            <ThemeIcon size={21} strokeWidth={1.5} />
            <span className="workbench-activity-label">Theme</span>
          </button>
          <Link
            href="/settings"
            aria-label="Account settings"
            title="Account settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className="workbench-activity-item flex h-12 items-center justify-center gap-3 text-surface-500 hover:text-surface-200"
          >
            <Settings size={22} strokeWidth={1.5} />
            <span className="workbench-activity-label">Settings</span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sign out"
            title="Sign out"
            className="workbench-activity-item flex h-12 w-full items-center justify-center gap-3 text-surface-500 hover:text-surface-200"
          >
            <LogOut size={21} strokeWidth={1.5} />
            <span className="workbench-activity-label">Sign out</span>
          </button>
        </div>
      </nav>
      {searchOpen && <WorkbenchSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

export function WorkbenchStatusBar({
  section,
  onShortcuts,
}: {
  section: string;
  onShortcuts: () => void;
}) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between gap-3 border-t border-surface-800 bg-workbench-chrome px-3 font-mono text-[10px] text-surface-400">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Columns3 size={12} className="shrink-0 text-primary-400" />
        <span className="shrink-0">Workspace OS</span><span className="text-surface-600">/</span>
        <span className="truncate">{section}</span>
      </span>
      <button
        type="button"
        onClick={onShortcuts}
        className="flex h-full shrink-0 items-center gap-2 px-2 hover:bg-surface-800"
      >
        <Keyboard size={12} />
        <span className="sr-only sm:not-sr-only">Keyboard shortcuts</span>
      </button>
    </div>
  );
}
