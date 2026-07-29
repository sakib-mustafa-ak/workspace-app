'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Menu } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const shortcuts = [
    { keys: ['g', 'd'], description: 'Go to Dashboard', action: () => router.push('/dashboard') },
    { keys: ['g', 'n'], description: 'Go to Notifications', action: () => router.push('/notifications') },
    { keys: ['g', 's'], description: 'Go to Settings', action: () => router.push('/settings') },
    { keys: ['g', 'u'], description: 'Go to Users', action: () => router.push('/users') },
  ];
  const { showCheatSheet, setShowCheatSheet } = useKeyboardShortcuts(shortcuts);

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

        <main className="relative flex min-w-0 flex-1 flex-col overflow-auto">
          <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-surface-800 bg-surface-950/80 px-4 backdrop-blur-md lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-primary-500 to-primary-700 text-[10px] font-bold text-white">
                W
              </div>
              <span className="text-sm font-semibold">Workspace OS</span>
            </div>
          </div>

          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

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
