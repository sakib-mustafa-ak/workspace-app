'use client';

import { AuthProvider } from '@/contexts/auth-context';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthProvider>
  );
}
