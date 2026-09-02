import Link from 'next/link';
import { WorkspaceLogo } from '@/components/workspace-logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-surface-800/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <WorkspaceLogo className="h-8 w-8" />
            <div>
              <div className="text-sm font-semibold tracking-wide text-surface-100">
                Workspace OS
              </div>
              <div className="text-xs text-surface-500">Work that stays layered, not lost.</div>
            </div>
          </div>
          <nav className="flex flex-col items-start gap-2 text-sm text-surface-400 sm:items-end">
            <Link href="/" className="transition-colors hover:text-primary-300">
              Overview
            </Link>
            <Link href="/auth/login" className="transition-colors hover:text-primary-300">
              Sign in
            </Link>
            <Link href="/auth/register" className="transition-colors hover:text-primary-300">
              Create account
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-3 text-xs text-surface-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Workspace OS</p>
          <div className="flex gap-5">
            <Link href="/legal/terms" className="transition-colors hover:text-surface-300">
              Terms
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-surface-300">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
