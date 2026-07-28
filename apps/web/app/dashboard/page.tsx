'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ExternalLink,
  LayoutDashboard,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
import { EmailVerificationBanner } from '@/components/email-verification-banner';

function CreateWorkspaceForm({
  onCreated,
  onCancel,
}: {
  onCreated: (ws: Workspace) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const ws = await workspacesApi.create({ name, slug });
      onCreated(ws);
    } catch {
      // handled
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-800/50 p-5 sm:p-6"
    >
      <h2 className="mb-4 text-sm font-semibold text-surface-200">Create workspace</h2>
      <div className="space-y-3">
        <input
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
          required
        />
        <input
          placeholder="slug (my-team)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-600/25 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    workspacesApi
      .list()
      .then(setWorkspaces)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <EmailVerificationBanner />

      {/* Welcome header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-surface-800/50 bg-gradient-to-br from-surface-900 via-surface-900 to-primary-950/20 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary-500/5 blur-2xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Hello, <span className="bg-gradient-to-r from-primary-300 to-primary-500 bg-clip-text text-transparent">{user?.displayName || 'there'}</span>
              </h1>
              <p className="mt-1.5 text-sm text-surface-400">
                {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} · {user?.email}
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
            >
              <Plus size={16} />
              New workspace
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="mb-8">
          <CreateWorkspaceForm
            onCreated={(ws) => {
              setWorkspaces((prev) => [ws, ...prev]);
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Workspace grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl bg-surface-800/50" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-800">
            <LayoutDashboard size={24} className="text-surface-500" />
          </div>
          <p className="mt-4 text-sm font-medium text-surface-400">No workspaces yet</p>
          <p className="mt-1 text-xs text-surface-500">Create one to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary-600/10 px-4 py-2 text-xs font-medium text-primary-400 transition-colors hover:bg-primary-600/20"
          >
            <Plus size={14} />
            Create workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaces.map((ws, i) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="group relative overflow-hidden rounded-xl border border-surface-800 bg-gradient-to-br from-surface-900 to-surface-900/50 p-5 transition-all hover:border-surface-700 hover:shadow-lg hover:shadow-primary-600/5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 text-sm font-bold text-primary-400 shadow-sm shadow-primary-600/10">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <ExternalLink
                  size={14}
                  className="mt-1 text-surface-600 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-surface-200 group-hover:text-white">
                {ws.name}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-surface-500">
                {ws.description || 'No description'}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-surface-600">
                <div className="h-1.5 w-1.5 rounded-full bg-surface-700" />
                /{ws.slug}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
