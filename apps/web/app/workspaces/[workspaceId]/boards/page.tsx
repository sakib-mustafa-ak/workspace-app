'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, Columns } from 'lucide-react';
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
    <div className="p-8">
      <div className="mb-8">
          <Link
            href={`/workspaces/${workspaceId}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white"
          >
            <ArrowLeft size={14} />
            {workspace?.name || 'Workspace'}
          </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {workspace?.name || 'Workspace'}
            </h1>
            <p className="mt-1 text-sm text-surface-400">
              {boards.length} board{boards.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            <Plus size={16} />
            New board
          </button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-surface-700 bg-surface-800 p-6"
        >
          <h2 className="mb-4 text-sm font-semibold">Create board</h2>
          <div className="space-y-3">
            <input
              placeholder="Board name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-surface-800"
            />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16">
          <Columns size={40} className="text-surface-600 mb-3" />
          <p className="text-sm text-surface-400">No boards yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/workspaces/${workspaceId}/boards/${board.id}`}
              className="group rounded-xl border border-surface-800 bg-surface-900 p-5 transition-colors hover:border-surface-700"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-400">
                {board.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="mt-3 font-medium">{board.name}</h3>
              <p className="mt-1 text-xs text-surface-500">
                {board.description || 'No description'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
