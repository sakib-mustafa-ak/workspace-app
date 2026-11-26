'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { WorkbenchActivityBar, WorkbenchStatusBar, WorkbenchTitleBar } from '@/components/workbench-chrome';
import { LayoutDashboard, Bell, Users, Settings, Puzzle, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useFocusTrap } from '@/hooks/use-focus-trap';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/plugins', label: 'Plugins', icon: Puzzle },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isBoardPage = /^\/workspaces\/[^/]+\/boards\/[^/]+\/?$/.test(pathname);
  const workspaceId = pathname.match(/^\/workspaces\/([^/]+)/)?.[1];
  const section = pathname === '/dashboard' ? 'Dashboard'
    : pathname === '/dashboard/plugins' ? 'Plugins'
    : pathname.endsWith('/canvas') ? 'Canvas'
    : isBoardPage ? 'Board'
    : pathname.endsWith('/manage') ? 'Workspace settings'
    : workspaceId ? 'Workspace'
    : pathname === '/notifications' ? 'Notifications'
    : pathname.startsWith('/users') ? 'People'
    : pathname === '/settings' ? 'Settings'
    : 'Workspace OS';
  const router = useRouter();

  const shortcuts = [
    { keys: ['g', 'd'], description: 'Go to Dashboard', action: () => router.push('/dashboard') },
    { keys: ['g', 'n'], description: 'Go to Notifications', action: () => router.push('/notifications') },
    { keys: ['g', 's'], description: 'Go to Settings', action: () => router.push('/settings') },
    { keys: ['g', 'u'], description: 'Go to Users', action: () => router.push('/users') },
  ];
  const { showCheatSheet, setShowCheatSheet } = useKeyboardShortcuts(shortcuts);
  const shortcutsTrapRef = useFocusTrap(showCheatSheet, () => setShowCheatSheet(false));

  return (
    <AuthProvider>
      <VerifiedAccess>
      <div className="ide-shell flex h-dvh flex-col bg-surface-950 text-surface-200">
        <WorkbenchTitleBar section={section} onShortcuts={() => setShowCheatSheet(true)} />
        <div className="flex min-h-0 flex-1">
        {showSidebar && <WorkbenchActivityBar />}
        <main className={`relative flex min-w-0 flex-1 flex-col overflow-auto ${showSidebar ? 'pb-16 lg:pb-0' : ''}`}>
          <nav aria-label="Page tabs" className="workbench-tabs flex h-9 shrink-0 items-stretch border-b border-surface-800 bg-workbench-chrome text-xs">
            <Link href="/dashboard" aria-current={pathname === '/dashboard' ? 'page' : undefined} className={`flex items-center gap-2 border-r border-surface-800 px-4 ${pathname === '/dashboard' ? 'border-t-2 border-t-primary-400 bg-workbench-tab text-surface-200' : 'text-surface-500 hover:text-surface-200'}`}><LayoutDashboard size={13} className="text-primary-400" />Dashboard</Link>
            {pathname !== '/dashboard' && <span aria-current="page" className="flex min-w-0 items-center gap-2 border-r border-t-2 border-surface-800 border-t-primary-400 bg-workbench-tab px-4 text-surface-200"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" /><span className="truncate">{section}</span></span>}
          </nav>
          {!showSidebar && <nav aria-label="Main navigation" className="flex shrink-0 items-center justify-between gap-4 border-b border-surface-800 px-5 py-3 text-sm">
            <div className="flex items-center gap-4"><Link href="/dashboard" className="font-semibold text-surface-300 hover:text-white">← Dashboard</Link>{workspaceId && !isBoardPage && <Link href={`/workspaces/${workspaceId}`} className="text-surface-500 hover:text-surface-200">Workspace home</Link>}</div>
            <div className="flex gap-4"><Link href="/notifications" aria-label="Notifications" className="text-surface-500 hover:text-surface-200"><Bell size={17} /></Link><Link href="/settings" aria-label="Account settings" className="text-surface-500 hover:text-surface-200"><Settings size={17} /></Link></div>
          </nav>}

          <ErrorBoundary>{children}</ErrorBoundary>

          <footer className="shrink-0 border-t border-surface-800 px-5 py-2 lg:px-6">
            <div className="flex flex-col gap-2 text-xs text-surface-500 sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} Workspace OS</span>
              <div className="flex gap-4">
                <Link href="/legal/terms" className="transition-colors hover:text-surface-300">
                  Terms
                </Link>
                <Link href="/legal/privacy" className="transition-colors hover:text-surface-300">
                  Privacy
                </Link>
              </div>
            </div>
          </footer>
        </main>

        {showSidebar && <nav className="fixed bottom-0 left-0 right-0 z-40 flex max-lg:flex lg:hidden border-t border-surface-800 bg-surface-950/95 backdrop-blur-md">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-caption ${
                pathname === item.href ? 'text-primary-400' : 'text-surface-500'
              }`}
            >
              <item.icon size={18} />
              <span className="sr-only">{item.label}</span>
            </Link>
          ))}
        </nav>}

        {showCheatSheet && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setShowCheatSheet(false)}>
            <div
              ref={shortcutsTrapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shortcuts-dialog-title"
              className="w-full max-w-sm rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-xl shadow-black/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 id="shortcuts-dialog-title" className="text-sm font-semibold">Keyboard Shortcuts</h3>
                <button type="button" aria-label="Close keyboard shortcuts" onClick={() => setShowCheatSheet(false)} className="flex h-8 w-8 items-center justify-center rounded-sm text-surface-400 hover:bg-surface-800"><X size={16} /></button>
              </div>
              <div className="space-y-2">
                {shortcuts.map((s) => (
                  <div key={s.keys.join('')} className="flex items-center justify-between text-sm">
                    <span className="text-surface-400">{s.description}</span>
                    <kbd className="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300 font-mono">
                      {s.keys.join(' ')}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
        <WorkbenchStatusBar section={section} onShortcuts={() => setShowCheatSheet(true)} />
      </div>
      </VerifiedAccess>
    </AuthProvider>
  );
}

function VerifiedAccess({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/auth/login');
    else if (!user.emailVerifiedAt) router.replace('/auth/check-email');
  }, [user, loading, router]);
  if (loading || !user?.emailVerifiedAt) return <div role="status" className="flex min-h-screen items-center justify-center text-sm text-surface-400">Checking your account...</div>;
  return children;
}
