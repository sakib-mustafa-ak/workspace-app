'use client';

import { AuthenticatedLayout } from '@/components/authenticated-layout';

export default function WorkspacesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
