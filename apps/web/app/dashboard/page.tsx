'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  LayoutDashboard,
  Loader2,
  ArrowRight,
  Columns3,
  Puzzle,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { workspacesApi, type Invitation, type Workspace } from '@/lib/workspaces';
import { tasksApi, type Task } from '@/lib/tasks';
import { boardsApi, type Board } from '@/lib/boards';
import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { getRecentBoards, type RecentBoard } from '@/lib/recent-activity';
import { getLastActiveWorkspace } from '@/lib/active-workspace';
import { DashboardEvents } from '@/components/dashboard-events';
import { SkeletonCard } from '@/components/skeleton';
import { DashboardWorkspaceCard } from '@/components/dashboard-workspace-card';
import { useToast } from '@/contexts/toast-context';

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
  const toast = useToast();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const ws = await workspacesApi.create({ name, slug });
      onCreated(ws);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="rounded-xl border border-surface-800 bg-surface-900 p-4"
    >
      <h2 className="mb-4 text-sm font-semibold text-surface-200">Create workspace</h2>
      <div className="space-y-3">
        <input
          aria-label="Workspace name"
          autoFocus
          maxLength={128}
          placeholder="Workspace name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugModified.current) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
          }}
          className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500/50"
          required
        />
        <input
          aria-label="Workspace URL slug"
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
            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
          >
            {creating ? 'Creating\u2026' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-400 transition-colors hover:bg-surface-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function TodoList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const allTasks = await tasksApi.listByUser(20);
        const sortedTasks = allTasks.sort((a, b) => {
          if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setTasks(sortedTasks);

        const boardIds = [...new Set(sortedTasks.map((t) => t.boardId))];
        const boardPromises = boardIds.map(async (boardId) => {
          try {
            const task = sortedTasks.find((t) => t.boardId === boardId);
            if (task) {
              const board = await boardsApi.getById(task.workspaceId, boardId);
              return { boardId, board };
            }
          } catch {
            return null;
          }
          return null;
        });

        const boardResults = await Promise.all(boardPromises);
        const boardMap: Record<string, Board> = {};
        boardResults.forEach((result) => {
          if (result) {
            boardMap[result.boardId] = result.board;
          }
        });
        setBoards(boardMap);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  return (
    <section aria-labelledby="dashboard-tasks-title" className="rounded-xl border border-surface-800 bg-surface-900/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 id="dashboard-tasks-title" className="text-sm font-semibold text-surface-200">Tasks</h3>
        {!loading && !error && <span className="text-xs text-surface-500">{tasks.length}</span>}
      </div>
      <p className="mb-4 text-xs text-surface-500">Across your workspaces</p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <p role="alert" className="py-4 text-xs text-surface-400">Could not load tasks. Refresh to try again.</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-surface-800 px-4 py-6"><p className="text-xs text-surface-400">Nothing to catch up on.</p><p className="mt-2 text-xs leading-relaxed text-surface-500">Open a board to plan your next task.</p></div>
      ) : (
        <div className="divide-y divide-surface-800">
          {tasks.slice(0, 8).map((task) => (
            <Link
              key={task.id}
              href={`/workspaces/${task.workspaceId}/boards/${task.boardId}`}
              className="block rounded-md px-1 py-3 transition-colors hover:bg-surface-800/50 focus-visible:outline-primary-400"
            >
              <p className="line-clamp-2 text-xs font-medium leading-relaxed text-surface-200">{task.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`text-caption font-medium ${
                    task.dueDate && isOverdue(task.dueDate)
                      ? 'text-red-400'
                      : 'text-surface-400'
                  }`}
                >
                  {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                </span>
                {(() => {
                  const board = boards[task.boardId];
                  return board ? (
                    <span className="max-w-36 truncate text-caption text-surface-500">
                      {board.name}
                    </span>
                  ) : null;
                })()}
              </div>
            </Link>
          ))}
          {tasks.length > 8 && (
            <Link
              href="/calendar"
              className="block py-3 text-xs text-surface-400 hover:underline"
            >
              View all {tasks.length} tasks
            </Link>
          )}
        </div>
      )}
    </section>
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
  const [lastActiveWs, setLastActiveWs] = useState<Workspace | null>(null);

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
    if (!user || workspaces.length === 0) {
      setLastActiveWs(null);
      return;
    }
    const stored = getLastActiveWorkspace(user.id);
    const match = stored ? workspaces.find((w) => w.id === stored) : undefined;
    setLastActiveWs(match ?? null);
  }, [user, workspaces]);

  useEffect(() => {
    workspacesApi.listMyPendingInvitations?.()
      .then(setPendingInvites)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRecentBoards(getRecentBoards());
  }, []);

  return (
    <div className="flex-1 shrink-0 bg-surface-950">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        <EmailVerificationBanner />

      <header className="mb-8 border-b border-surface-800 pb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-surface-500">Your overview</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Hello, {user?.displayName || 'there'}
            </h1>
            <p className="mt-2 text-sm text-surface-500">Pick up where you left off.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/plugins" className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-xs font-medium text-surface-200 hover:border-surface-500"><Puzzle size={16} />Plugins</Link>
          <button
            onClick={() => setShowCreate(true)}
            aria-expanded={showCreate}
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-xs font-medium text-surface-200 transition-colors hover:border-surface-500 focus-visible:outline-primary-400"
          >
            <Plus size={16} />
            New workspace
          </button>
          </div>
        </div>
      </header>

      {/* Invitations banner */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 animate-slideIn rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          You have {pendingInvites.length} pending invitation{pendingInvites.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Continue in last-active workspace */}
      {lastActiveWs && (
        <Link
          href={`/workspaces/${lastActiveWs.id}`}
          className="mb-8 flex items-center justify-between gap-3 rounded-xl border border-surface-800 bg-surface-900/40 px-4 py-3 transition-colors hover:border-surface-600"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-800 text-xs font-semibold text-surface-400">
              {lastActiveWs.name.charAt(0).toUpperCase()}
            </div>
            <p className="truncate text-sm text-surface-200">
              Continue in <span className="font-medium text-surface-200">{lastActiveWs.name}</span>
            </p>
          </div>
          <ArrowRight size={15} className="shrink-0 text-surface-500" />
        </Link>
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

      <div className="grid min-w-0 grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Workspace list */}
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
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} className="overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-700/20 to-transparent animate-shimmer" />
                </SkeletonCard>
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-24">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-800">
                <LayoutDashboard size={36} className="text-surface-600" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-surface-300">No workspaces yet</h3>
              <p className="mt-1 text-sm text-surface-500">Create your first workspace to get started</p>
              <button onClick={() => setShowCreate(true)} className="mt-6 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-xs font-medium text-surface-200 hover:border-surface-500">
                <Plus size={16} />
                Create workspace
              </button>
            </div>
          ) : (
            <section aria-labelledby="workspaces-title">
              <div className="mb-4 flex items-center justify-between gap-3"><h2 id="workspaces-title" className="text-sm font-semibold text-surface-200">Your workspaces <span className="ml-2 text-xs font-normal text-surface-500">{workspaces.length}</span></h2><span className="hidden text-[11px] text-surface-600 sm:inline">Hover to preview boards</span></div>
              <div className="space-y-3">
                {workspaces.map((ws) => (
                  <DashboardWorkspaceCard key={ws.id} workspace={ws} />
                ))}
              </div>
            </section>
          )}
          {recentBoards.length > 0 && (
            <section aria-labelledby="recent-boards-title" className="min-w-0">
              <h2 id="recent-boards-title" className="mb-4 text-sm font-semibold text-surface-300">Recently opened</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recentBoards.map((rb) => {
                  const workspaceName = rb.workspaceName || workspaces.find((ws) => ws.id === rb.workspaceId)?.name;
                  return (
                    <Link key={rb.id} href={`/workspaces/${rb.workspaceId}/boards/${rb.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-surface-800 bg-surface-900/40 p-4 transition-colors hover:border-surface-600">
                      <Columns3 size={16} className="shrink-0 text-surface-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-surface-200">{rb.name}</p>
                        {workspaceName && <p className="mt-1 truncate text-[11px] text-surface-500">{workspaceName}</p>}
                      </div>
                      <ArrowRight size={13} className="shrink-0 text-surface-600" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside aria-label="Tasks and events" className="min-w-0 space-y-4">
          <TodoList />
          <DashboardEvents />
        </aside>
      </div>
      </div>
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
