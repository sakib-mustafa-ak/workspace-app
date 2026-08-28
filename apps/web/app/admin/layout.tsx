'use client';

import { AuthProvider } from '@/contexts/auth-context';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
