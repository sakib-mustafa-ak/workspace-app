'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  Users,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { workspacesApi, type Invitation, type Workspace } from '@/lib/workspaces';
import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { getRecentBoards, type RecentBoard } from '@/lib/recent-activity';

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
  const slugModified = useRef(false);

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
      className="rounded-xl border border-surface-800 bg-surface-900 p-5 sm:p-6"
    >
      <h2 className="mb-4 text-sm font-semibold text-surface-200">Create workspace</h2>
      <div className="space-y-3">
        <input
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500/50"
          required
        />
        <input
          placeholder="slug (my-team)"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            slugModified.current = true;
          }}
          className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500/50"
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-600/25 disabled:opacity-50"
          >
            {creating ? 'Creating\u2026' : 'Create'}
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
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);

  function loadWorkspaces() {
    setLoading(true);
    setLoadError('');
    workspacesApi
      .list()
      .then(setWorkspaces)
      .catch(() => setLoadError('Failed to load your workspaces. Please try again.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadWorkspaces(); }, []);

  useEffect(() => {
    workspacesApi.listMyPendingInvitations?.()
      .then(setPendingInvites)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRecentBoards(getRecentBoards());
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <EmailVerificationBanner />

      {/* Welcome header */}
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-label text-surface-500">Workspace OS</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Hello, <span className="text-warm-300">{user?.displayName || 'there'}</span>
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} · {user?.email}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
        >
          <Plus size={16} />
          New workspace
        </button>
      </div>

      {/* Invitations banner */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 animate-slideIn rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          You have {pendingInvites.length} pending invitation{pendingInvites.length > 1 ? 's' : ''}
        </div>
      )}

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

      {/* Recent boards */}
      {recentBoards.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-label text-surface-500">Recent boards</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {recentBoards.map((rb) => (
              <Link
                key={rb.id}
                href={`/workspaces/${rb.workspaceId}/boards/${rb.id}`}
                className="group shrink-0 rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all hover:border-surface-700 hover:bg-surface-800/50"
              >
                <p className="text-sm font-medium text-surface-200 group-hover:text-white">{rb.name}</p>
                <p className="mt-0.5 text-xs text-primary-400">{rb.workspaceName}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Workspace grid */}
      {loadError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-24">
          <p className="text-sm font-medium text-red-400">{loadError}</p>
          <button
            onClick={loadWorkspaces}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-surface-800/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-700/20 to-transparent animate-shimmer" />
            </div>
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-24">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-800">
            <LayoutDashboard size={36} className="text-surface-600" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-surface-300">No workspaces yet</h3>
          <p className="mt-1 text-sm text-surface-500">Create your first workspace to get started</p>
          <button onClick={() => setShowCreate(true)} className="mt-6 flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 hover:bg-primary-500">
            <Plus size={16} />
            Create workspace
          </button>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-label text-surface-500">All workspaces</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map((ws, i) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="group relative overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-5 transition-all hover:border-surface-700 hover:bg-surface-800/50 animate-fadeIn"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
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
                <h3 className="underline-grow mt-4 text-sm font-semibold text-primary-400 group-hover:text-white">
                  {ws.name}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-surface-500">
                  {ws.description || 'No description'}
                </p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-surface-600">
                  <span className="flex items-center gap-1"><Users size={11} />{ws.memberCount ?? 1}</span>
                  <span className="text-surface-700">·</span>
                  <span className="flex items-center gap-1"><LayoutGrid size={11} />{ws.boardCount ?? 0}</span>
                  <span className="text-surface-700">·</span>
                  <span>/{ws.slug}</span>
                </div>
              </Link>
            ))}
          </div>
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
