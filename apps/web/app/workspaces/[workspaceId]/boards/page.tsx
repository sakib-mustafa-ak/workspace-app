'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Columns, Search, Archive, Trash2 } from 'lucide-react';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
import { boardsApi, type Board } from '@/lib/boards';
import { SkeletonCard } from '@/components/skeleton';
import { useToast } from '@/contexts/toast-context';
import { ConfirmModal } from '@/components/confirm-modal';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default function BoardsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const toast = useToast();

  function loadBoards() {
    setLoading(true);
    setError('');
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.list(workspaceId),
    ])
      .then(([ws, boardList]) => {
        setWorkspace(ws);
        setBoards(boardList);
      })
      .catch(() => setError('Failed to load this workspace. It may have been deleted or you may not have access.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadBoards(); }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDeleteBoard() {
    if (!deleteTargetId) return;
    setConfirmDelete(false);
    try {
      await boardsApi.delete(workspaceId, deleteTargetId);
      loadBoards();
    } catch {
      toast.error('Failed to delete board. Please try again.');
    }
    setDeleteTargetId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const board = await boardsApi.create(workspaceId, { name });
      setBoards((prev) => [...prev, board]);
      setShowCreate(false);
      setName('');
    } catch {
      toast.error('Failed to create board. Please try again.');
    }
  }

  const filteredBoards = boards.filter((b) => {
    const q = searchQuery.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || (b.description?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: workspace?.name || 'Workspace', href: `/workspaces/${workspaceId}` },
        ]}
        currentLabel="Boards"
      />

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

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-surface-800 bg-surface-900 px-3 py-2">
        <Search size={16} className="text-surface-500" />
        <input
          type="text"
          placeholder="Search boards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-surface-500"
        />
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-800/50 p-4"
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

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-20">
          <p className="text-sm font-medium text-red-400">{error}</p>
          <button
            onClick={() => loadBoards()}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/30 py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-800">
            <Columns size={24} className="text-surface-500" />
          </div>
          <p className="mt-4 text-sm font-medium text-surface-400">
            {searchQuery ? 'No boards match your search' : 'No boards yet'}
          </p>
          <p className="mt-1 text-xs text-surface-500">
            {searchQuery ? 'Try a different search term' : 'Create a board to organize your tasks'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary-600/10 px-4 py-2 text-xs font-medium text-primary-400 transition-colors hover:bg-primary-600/20"
            >
              <Plus size={14} />
              Create board
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBoards.map((board) => (
            <div key={board.id} className="group relative overflow-hidden rounded-xl border border-surface-800 bg-gradient-to-br from-surface-900 to-surface-900/50 p-4 transition-all hover:border-surface-700 hover:shadow-lg hover:shadow-primary-600/5">
              <Link href={`/workspaces/${workspaceId}/boards/${board.id}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/10 text-sm font-bold text-emerald-400 shadow-sm shadow-emerald-600/10">
                  {board.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-surface-200 group-hover:text-white">
                  {board.name}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-surface-500">
                  {board.description || 'No description'}
                </p>
              </Link>
              {board.archivedAt && (
                <span className="mt-3 inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-caption font-medium text-amber-400">
                  Archived
                </span>
              )}
              <div className="mt-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {board.archivedAt ? (
                  <button
                    onClick={() => boardsApi.unarchive(workspaceId, board.id).then(() => loadBoards())}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-surface-400 hover:bg-surface-800 hover:text-white"
                  >
                    <Archive size={12} /> Unarchive
                  </button>
                ) : (
                  <button
                    onClick={() => boardsApi.archive(workspaceId, board.id).then(() => loadBoards())}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-surface-400 hover:bg-surface-800 hover:text-white"
                  >
                    <Archive size={12} /> Archive
                  </button>
                )}
                <button
                  onClick={() => { setDeleteTargetId(board.id); setConfirmDelete(true); }}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal
        open={confirmDelete}
        title="Delete this board?"
        description="This action cannot be undone. All tasks and data in this board will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDeleteBoard}
        onCancel={() => { setConfirmDelete(false); setDeleteTargetId(null); }}
      />
    </div>
  );
}
