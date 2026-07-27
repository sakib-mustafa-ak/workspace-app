'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, MessageSquare, Settings, Pencil, Archive,
  Trash2, X, Check,
} from 'lucide-react';
import { workspacesApi } from '@/lib/workspaces';
import { boardsApi, type Board, type BoardColumn } from '@/lib/boards';
import { tasksApi, type Task } from '@/lib/tasks';
import { CommentsPanel } from '@/components/comments-panel';
import { TaskModal } from '@/components/task-modal';

type ModalState =
  | { type: 'create'; columnId: string }
  | { type: 'edit'; task: Task }
  | null;

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const [editingBoard, setEditingBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');

  const [newColName, setNewColName] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');

  function loadBoard() {
    setLoading(true);
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.getById(workspaceId, boardId),
      boardsApi.getColumns(workspaceId, boardId),
      tasksApi.listByBoard(workspaceId, boardId),
    ])
      .then(([, brd, cols, tsks]) => {
        setBoard(brd);
        setColumns(cols.filter((c) => c.status !== 'ARCHIVED'));
        setTasks(tsks.filter((t) => t.status !== 'DELETED'));
      })
      .catch(() => router.push(`/workspaces/${workspaceId}/boards`))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadBoard(); }, [workspaceId, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpdateBoard() {
    try {
      const updated = await boardsApi.update(workspaceId, boardId, {
        name: boardName.trim() || undefined,
        description: boardDesc.trim() || null,
      });
      setBoard(updated);
      setEditingBoard(false);
    } catch { /* handled */ }
  }

  async function handleArchiveBoard() {
    try {
      await boardsApi.archive(workspaceId, boardId);
      router.push(`/workspaces/${workspaceId}/boards`);
    } catch { /* handled */ }
  }

  async function handleUnarchiveBoard() {
    try {
      await boardsApi.unarchive(workspaceId, boardId);
      if (board) setBoard({ ...board, status: 'ACTIVE', archivedAt: null });
    } catch { /* handled */ }
  }

  async function handleDeleteBoard() {
    if (!confirm('Delete this board? This cannot be undone.')) return;
    try {
      await boardsApi.delete(workspaceId, boardId);
      router.push(`/workspaces/${workspaceId}/boards`);
    } catch { /* handled */ }
  }

  async function handleCreateColumn() {
    if (!newColName.trim()) return;
    try {
      const col = await boardsApi.createColumn(workspaceId, boardId, { name: newColName.trim() });
      setColumns((prev) => [...prev, col]);
      setNewColName('');
    } catch { /* handled */ }
  }

  async function handleUpdateColumn(colId: string) {
    if (!editingColName.trim()) return;
    try {
      const updated = await boardsApi.updateColumn(workspaceId, boardId, colId, { name: editingColName.trim() });
      setColumns((prev) => prev.map((c) => (c.id === colId ? updated : c)));
      setEditingColId(null);
    } catch { /* handled */ }
  }

  async function handleArchiveColumn(colId: string) {
    try {
      await boardsApi.archiveColumn(workspaceId, boardId, colId);
      setColumns((prev) => prev.filter((c) => c.id !== colId));
      setTasks((prev) => prev.filter((t) => t.columnId !== colId));
    } catch { /* handled */ }
  }

  function handleTaskSaved(task: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = task;
        return next;
      }
      return [...prev, task];
    });
  }

  function handleTaskDeleted(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
      </div>
    );
  }

  if (!board) return null;

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  const colOptions = sortedColumns.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-surface-800 px-8 py-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/workspaces/${workspaceId}/boards`}
            className="text-surface-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </Link>
          {editingBoard ? (
            <div className="flex items-center gap-2">
              <input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-sm outline-none focus:border-primary-500"
              />
              <button onClick={handleUpdateBoard} className="rounded p-1 text-emerald-400 hover:bg-surface-800">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingBoard(false)} className="rounded p-1 text-surface-500 hover:bg-surface-800">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-bold">{board.name}</h1>
              <p className="text-xs text-surface-500">
                {board.description || 'No description'}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              showComments
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
            }`}
          >
            <MessageSquare size={14} />
            Comments
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200"
            >
              <Settings size={16} />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-surface-800 bg-surface-900 py-1 shadow-xl" onClick={() => setShowSettings(false)}>
                <button
                  onClick={() => { setEditingBoard(true); setBoardName(board.name); setBoardDesc(board.description || ''); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs text-surface-300 hover:bg-surface-800"
                >
                  <Pencil size={12} /> Edit board
                </button>
                {board.archivedAt ? (
                  <button onClick={handleUnarchiveBoard} className="flex w-full items-center gap-2 px-4 py-2 text-xs text-surface-300 hover:bg-surface-800">
                    <Archive size={12} /> Unarchive
                  </button>
                ) : (
                  <button onClick={handleArchiveBoard} className="flex w-full items-center gap-2 px-4 py-2 text-xs text-surface-300 hover:bg-surface-800">
                    <Archive size={12} /> Archive
                  </button>
                )}
                <button onClick={handleDeleteBoard} className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {sortedColumns.map((col) => {
            const colTasks = tasks
              .filter((t) => t.columnId === col.id)
              .sort((a, b) => a.position - b.position);

            return (
              <div key={col.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-900">
                <div className="flex items-center justify-between px-4 py-3">
                  {editingColId === col.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editingColName}
                        onChange={(e) => setEditingColName(e.target.value)}
                        className="w-28 rounded border border-surface-700 bg-surface-800 px-1.5 py-0.5 text-xs outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleUpdateColumn(col.id)} className="text-emerald-400">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingColId(null)} className="text-surface-500">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-surface-300">{col.name}</h3>
                      <span className="rounded-md bg-surface-800 px-2 py-0.5 text-xs text-surface-500">
                        {colTasks.length}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingColId(col.id); setEditingColName(col.name); }}
                      className="rounded p-0.5 text-surface-500 hover:text-surface-300"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={() => handleArchiveColumn(col.id)}
                      className="rounded p-0.5 text-surface-500 hover:text-red-400"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 px-3 pb-3">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setModal({ type: 'edit', task })}
                      className="cursor-pointer rounded-lg border border-surface-800 bg-surface-950 p-3 transition-colors hover:border-surface-700"
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
                          <span className="text-xs text-surface-500">Assigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-surface-800 px-3 py-2">
                  <button
                    onClick={() => setModal({ type: 'create', columnId: col.id })}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-300"
                  >
                    <Plus size={12} />
                    Add task
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex w-56 shrink-0 flex-col">
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-surface-700 p-3">
              <input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="New column name"
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-surface-600"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateColumn()}
              />
              <button onClick={handleCreateColumn} className="text-primary-400 hover:text-primary-300">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {showComments && (
          <div className="w-80 shrink-0">
            <CommentsPanel boardId={boardId} />
          </div>
        )}
      </div>

      {modal?.type === 'create' && (
        <TaskModal
          mode="create"
          workspaceId={workspaceId}
          boardId={boardId}
          columnId={modal.columnId}
          onClose={() => setModal(null)}
          onSaved={handleTaskSaved}
        />
      )}
      {modal?.type === 'edit' && modal.task && (
        <TaskModal
          mode="edit"
          task={modal.task}
          workspaceId={workspaceId}
          boardId={boardId}
          columns={colOptions}
          onClose={() => setModal(null)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
