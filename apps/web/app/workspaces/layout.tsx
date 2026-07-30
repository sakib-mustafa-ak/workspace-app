'use client';

import { AuthProvider } from '@/contexts/auth-context';

export default function WorkspacesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
