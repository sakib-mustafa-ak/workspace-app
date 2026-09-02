import Link from 'next/link';
import {
  PLAN_FEATURE_BY_ID,
  PLAN_FEATURE_SHORT_LABEL,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_SHORT_DESCRIPTION,
  PRICED_PLAN_IDS,
  PRICED_PLAN_MONTHLY_PRICE_CENTS,
} from '@repo/plans';
import { WorkspaceLogo } from '@/components/workspace-logo';
import { SiteFooter } from '@/components/site-footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace OS',
  description:
    'The collaborative workspace for real-time boards, tasks, and shared context — layers of work, kept in one place.',
  openGraph: {
    title: 'Workspace OS',
    description:
      'The collaborative workspace for real-time boards, tasks, and shared context — layers of work, kept in one place.',
    type: 'website',
  },
};

const features = [
  {
    label: 'Live canvas',
    body: 'A shared board where everyone sees edits as they happen. Draw, comment, and move work together without refresh races.',
  },
  {
    label: 'Tasks & checklists',
    body: 'Turn notes into tracked work with tasks, subtask checklists, and statuses that show up where your team is looking.',
  },
  {
    label: 'Workspace-scoped search',
    body: 'Find a board, a task, a comment — scoped to the workspace you are in, so results stay relevant, not global.',
  },
  {
    label: 'Team access, clearly drawn',
    body: 'Invite teammates, assign roles, and keep ownership explicit. Every workspace decides who is in and who owns what.',
  },
  {
    label: 'AI where context lives',
    body: 'Summarize a board or surface fresh ideas from what the workspace has already captured — not from a blank prompt.',
  },
  {
    label: 'An audit trail you can export',
    body: 'Changes are recorded against the workspace. Teams that need oversight can export their audit log at any time.',
  },
];

function formatPrice(planId: 'PRO' | 'TEAM' | 'FREE') {
  if (planId === 'FREE') return '$0';
  const cents = PRICED_PLAN_MONTHLY_PRICE_CENTS[planId];
  if (cents === 0) return 'Not yet priced';
  return `$${(cents / 100).toFixed(0)}`;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      <header className="sticky top-0 z-40 border-b border-surface-800/70 bg-surface-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="Workspace OS home">
            <WorkspaceLogo className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-wide">Workspace OS</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/auth/login" className="text-surface-300 transition-colors hover:text-surface-100">
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-surface-800/70">
          <div className="pointer-events-none absolute -right-48 -top-48 h-[560px] w-[560px] rounded-full bg-primary-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-56 -left-40 h-[520px] w-[520px] rounded-full bg-primary-600/10 blur-3xl" />

          <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-6 pb-20 pt-20 sm:px-10 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-28">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-surface-800 bg-surface-900/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-primary-300">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                Real-time collaborative workspace
              </p>
              <h1 className="max-w-lg text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                Work that stays layered, not lost.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-surface-400">
                Boards, tasks, and context in one shared surface. Changes reach
                everyone the moment they happen — so the whole team is always
                on the same layer.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/register"
                  className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30"
                >
                  Create your workspace
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-lg border border-surface-700 bg-surface-900/50 px-5 py-3 text-sm font-medium text-surface-200 transition-colors hover:border-surface-600 hover:bg-surface-900"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="relative" aria-hidden="true">
              <LayerStack />
            </div>
          </div>
        </section>

        <section className="border-b border-surface-800/70">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-surface-500">
              What it does
            </p>
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your team actually works in, stacked in one place.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-surface-800 bg-surface-800 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.label} className="bg-surface-950 p-6">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-surface-800 bg-surface-900">
                    <WorkspaceLogo className="h-5 w-5" name={f.label.charAt(0)} />
                  </div>
                  <h3 className="text-base font-semibold">{f.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-surface-400">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-surface-800/70" id="pricing">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-surface-500">
              Pricing
            </p>
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              Start free. Grow when the work does.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-surface-400">
              Plans and limits are read from the same source that enforces them
              in the app, so what you see here is what your workspace allows.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {([...PRICED_PLAN_IDS, 'FREE'] as const).map((planId) => {
                const limits = PLAN_LIMITS[planId];
                const isFree = planId === 'FREE';
                return (
                  <div
                    key={planId}
                    className={`flex flex-col rounded-2xl border p-6 ${
                      isFree
                        ? 'border-surface-800 bg-surface-900/40'
                        : 'border-primary-600/40 bg-gradient-to-br from-surface-900 to-surface-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{PLAN_LABELS[planId]}</h3>
                      <span className="text-xs font-medium uppercase tracking-wide text-surface-500">
                        {isFree ? 'Everyone' : 'Scaled'}
                      </span>
                    </div>
                    <p className="mt-2 h-10 text-sm leading-relaxed text-surface-400">
                      {PLAN_SHORT_DESCRIPTION[planId]}
                    </p>
                    <div className="mt-4 text-3xl font-bold">
                      {formatPrice(planId)}
                      <span className="text-sm font-normal text-surface-500"> / month</span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-2 text-sm text-surface-300">
                      <li>
                        {limits.boards === null ? 'Unlimited' : `${limits.boards} active`} boards
                      </li>
                      <li>{limits.members === null ? 'Unlimited' : `${limits.members}`} members</li>
                      <li>
                        {limits.ownedWorkspaces === null
                          ? 'Unlimited workspaces'
                          : `${limits.ownedWorkspaces} owned workspace`}
                      </li>
                      {PLAN_FEATURE_BY_ID[planId].length > 0 ? (
                        <li className="text-surface-400">
                          {PLAN_FEATURE_BY_ID[planId].map((f) => PLAN_FEATURE_SHORT_LABEL[f]).join(', ')}
                        </li>
                      ) : (
                        <li className="text-surface-500">Essential collaboration</li>
                      )}
                    </ul>
                    <Link
                      href="/auth/register"
                      className={`mt-8 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-all ${
                        isFree
                          ? 'border border-surface-700 text-surface-200 hover:border-surface-600'
                          : 'bg-primary-600 text-white shadow-lg shadow-primary-600/20 hover:bg-primary-500'
                      }`}
                    >
                      {formatPrice(planId) === 'Not yet priced' ? 'Get early access' : 'Choose this'}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-xs text-surface-500">
              Pro and Team are not yet open for billing. Prices shown are placeholders until
              confirmed.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function LayerStack() {
  return (
    <div className="relative mx-auto max-w-md">
      <div className="absolute -inset-6 rounded-full bg-primary-500/10 blur-3xl" />
      <div className="relative rotate-[-4deg] space-y-4">
        <div className="rounded-xl border border-surface-700 bg-surface-900/80 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-400" />
            <span className="text-xs font-semibold text-surface-200">Research</span>
            <span className="ml-auto text-xs text-surface-500">3 people editing</span>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-3/4 rounded bg-surface-700/70" />
            <div className="h-2 w-1/2 rounded bg-surface-700/50" />
            <div className="h-2 w-2/3 rounded bg-primary-600/40" />
          </div>
        </div>
        <div className="ml-8 rounded-xl border border-surface-700 bg-surface-900/80 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-warm-400" />
            <span className="text-xs font-semibold text-surface-200">Launch plan</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-950/60 px-3 py-2">
              <span className="text-xs text-surface-300">Draft announcement</span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Done</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-950/60 px-3 py-2">
              <span className="text-xs text-surface-300">Confirm pricing</span>
              <span className="rounded bg-warm-400/15 px-1.5 py-0.5 text-[10px] font-medium text-warm-400">Blocked</span>
            </div>
          </div>
        </div>
      </div>
      <div className="relative -mt-2 ml-16 w-2/3 rounded-xl border border-surface-700 bg-surface-900/80 p-4 backdrop-blur">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-surface-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-surface-600" />
        </div>
        <div className="h-20 w-full rounded-lg border border-surface-800 bg-surface-950/60" />
      </div>
    </div>
  );
}
