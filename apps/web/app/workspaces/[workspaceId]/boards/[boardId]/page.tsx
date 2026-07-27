'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { workspacesApi } from '@/lib/workspaces';
import { boardsApi, type Board, type BoardColumn } from '@/lib/boards';
import { tasksApi, type Task } from '@/lib/tasks';

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.getById(workspaceId, boardId),
      boardsApi.getColumns(workspaceId, boardId),
      tasksApi.listByBoard(workspaceId, boardId),
    ])
      .then(([, brd, cols, tsks]) => {
        setBoard(brd);
        setColumns(cols);
        setTasks(tsks);
      })
      .catch(() => router.push(`/workspaces/${workspaceId}/boards`))
      .finally(() => setLoading(false));
  }, [workspaceId, boardId, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
      </div>
    );
  }

  if (!board) return null;

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-surface-800 px-8 py-4">
        <Link
          href={`/workspaces/${workspaceId}/boards`}
          className="text-surface-400 hover:text-white"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold">{board.name}</h1>
          <p className="text-xs text-surface-500">
            {board.description || 'No description'}
          </p>
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {sortedColumns.map((col) => {
          const colTasks = tasks
            .filter((t) => t.columnId === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={col.id}
              className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-900"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-sm font-medium text-surface-300">
                  {col.name}
                </h3>
                <span className="rounded-md bg-surface-800 px-2 py-0.5 text-xs text-surface-500">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 px-3 pb-3">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-surface-800 bg-surface-950 p-3 transition-colors hover:border-surface-700"
                  >
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          task.priority === 'CRITICAL'
                            ? 'bg-red-500/10 text-red-400'
                            : task.priority === 'HIGH'
                              ? 'bg-orange-500/10 text-orange-400'
                              : task.priority === 'MEDIUM'
                                ? 'bg-yellow-500/10 text-yellow-400'
                                : 'bg-surface-800 text-surface-500'
                        }`}
                      >
                        {task.priority}
                      </span>
                      {task.assigneeId && (
                        <span className="text-xs text-surface-500">
                          Assigned
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-surface-800 px-3 py-2">
                <button className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-300">
                  <Plus size={12} />
                  Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
