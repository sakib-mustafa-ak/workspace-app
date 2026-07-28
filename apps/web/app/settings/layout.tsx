'use client';

import { AuthenticatedLayout } from '@/components/authenticated-layout';

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
