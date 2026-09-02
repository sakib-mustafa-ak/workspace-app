import Link from 'next/link';
import { WorkspaceLogo } from '@/components/workspace-logo';
import { SiteFooter } from '@/components/site-footer';

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      <header className="border-b border-surface-800/70">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-5 sm:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="Workspace OS home">
            <WorkspaceLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wide">Workspace OS</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-14 sm:px-10">{children}</main>
      <div className="mt-4">
        <SiteFooter />
      </div>
    </div>
  );
}
