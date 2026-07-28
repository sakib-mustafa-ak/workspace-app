'use client';

import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Menu } from 'lucide-react';

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
