'use client';

import { AuthProvider } from '@/contexts/auth-context';

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}