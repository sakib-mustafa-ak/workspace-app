'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, Columns, Loader2 } from 'lucide-react';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';

export default function BoardsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.list(workspaceId),
    ])
      .then(([ws, boardList]) => {
        setWorkspace(ws);
        setBoards(boardList);
      })
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, [workspaceId, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const board = await boardsApi.create(workspaceId, { name });
      setBoards((prev) => [...prev, board]);
      setShowCreate(false);
      setName('');
    } catch {
      // handled
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={`/workspaces/${workspaceId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        {workspace?.name || 'Workspace'}
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Boards</h1>
          <p className="mt-1 text-sm text-surface-400">
            {boards.length} board{boards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-[0.98]"
        >
          <Plus size={16} />
          New board
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-800/50 p-5 sm:p-6"
        >
          <h2 className="mb-4 text-sm font-semibold text-surface-200">Create board</h2>
          <div className="space-y-3">
            <input
              placeholder="Board name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-600/25"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary-500" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-800">
            <Columns size={24} className="text-surface-500" />
          </div>
          <p className="mt-4 text-sm font-medium text-surface-400">No boards yet</p>
          <p className="mt-1 text-xs text-surface-500">Create a board to organize your tasks</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary-600/10 px-4 py-2 text-xs font-medium text-primary-400 transition-colors hover:bg-primary-600/20"
          >
            <Plus size={14} />
            Create board
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/workspaces/${workspaceId}/boards/${board.id}`}
              className="group relative overflow-hidden rounded-xl border border-surface-800 bg-gradient-to-br from-surface-900 to-surface-900/50 p-5 transition-all hover:border-surface-700 hover:shadow-lg hover:shadow-primary-600/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/10 text-sm font-bold text-emerald-400 shadow-sm shadow-emerald-600/10">
                {board.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-surface-200 group-hover:text-white">
                {board.name}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-surface-500">
                {board.description || 'No description'}
              </p>
              {board.archivedAt && (
                <span className="mt-3 inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  Archived
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
