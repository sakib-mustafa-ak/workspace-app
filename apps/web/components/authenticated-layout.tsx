'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/contexts/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Menu, LayoutDashboard, Bell, Users, Settings } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const shortcuts = [
    { keys: ['g', 'd'], description: 'Go to Dashboard', action: () => router.push('/dashboard') },
    { keys: ['g', 'n'], description: 'Go to Notifications', action: () => router.push('/notifications') },
    { keys: ['g', 's'], description: 'Go to Settings', action: () => router.push('/settings') },
    { keys: ['g', 'u'], description: 'Go to Users', action: () => router.push('/users') },
  ];
  const { showCheatSheet, setShowCheatSheet } = useKeyboardShortcuts(shortcuts);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <AuthProvider>
      <div className="flex h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 -translate-x-full transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : ''
          }`}
        >
          <Sidebar />
        </div>

<main className="relative flex min-w-0 flex-1 flex-col overflow-auto pb-16 lg:pb-0">
          <div className="sticky top-0 z-30 flex h-20 flex-col items-center justify-center border-b border-surface-800/70 bg-surface-950/70 px-4 backdrop-blur-xl lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              title="Open navigation menu"
              aria-label="Open navigation menu"
              className="absolute left-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-surface-800 bg-surface-900 text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
            >
              <Menu size={22} />
            </button>
            <span className="text-xl font-bold uppercase tracking-[0.26em] text-surface-100">Workspace</span>
            <span className="mt-1.5 text-xs font-medium uppercase tracking-[0.26em] text-surface-500">OS</span>
          </div>

          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-surface-800 bg-surface-950/95 backdrop-blur-md">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-caption ${
                pathname === item.href ? 'text-primary-400' : 'text-surface-500'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {showCheatSheet && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setShowCheatSheet(false)}>
          <div className="w-full max-w-sm rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Keyboard Shortcuts</h3>
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
    </AuthProvider>
  );
}
