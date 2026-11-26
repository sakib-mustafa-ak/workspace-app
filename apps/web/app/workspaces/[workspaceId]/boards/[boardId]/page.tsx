'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Pencil, X, Check, MoreHorizontal } from 'lucide-react';
import {
  DndContext, closestCorners, KeyboardSensor,
  PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { workspacesApi } from '@/lib/workspaces';
import { boardsApi, type Board, type BoardColumn } from '@/lib/boards';
import { tasksApi, type Task } from '@/lib/tasks';
import { SkeletonBlock, SkeletonCard } from '@/components/skeleton';
import { CommentsPanel } from '@/components/comments-panel';
import { TaskModal } from '@/components/task-modal';
import { SortableTaskCard } from '@/components/sortable-task-card';
import { BoardFileSidebar } from '@/components/board-file-sidebar';
import { AiSummarizePanel } from '@/components/ai-summarize-panel';
import { AiIdeasDialog } from '@/components/ai-ideas-dialog';
import { CalendarView } from '@/components/calendar-view';
import { addRecentBoard } from '@/lib/recent-activity';
import { useToast } from '@/contexts/toast-context';
import { ConfirmModal } from '@/components/confirm-modal';
import { BoardToolbar } from '@/components/board-toolbar';
import { BoardListSurface } from '@/components/board-list-surface';
import { WorkbenchSidePanel } from '@/components/workbench-side-panel';

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
  const [workspace, setWorkspace] = useState<{ name: string } | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showAiIdeas, setShowAiIdeas] = useState(false);
  const [search, setSearch] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  const [editingBoard, setEditingBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');

  const [newColName, setNewColName] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function loadBoard() {
    setLoading(true);
    setError('');
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.getById(workspaceId, boardId),
      boardsApi.getColumns(workspaceId, boardId),
      tasksApi.listByBoard(workspaceId, boardId),
    ])
      .then(([ws, brd, cols, tsks]) => {
        setWorkspace({ name: ws.name });
        setBoard(brd);
        setColumns(cols.filter((c) => c.status !== 'ARCHIVED'));
        setTasks(tsks.filter((t) => t.status !== 'DELETED'));
      })
      .catch(() => setError('Failed to load this board. It may have been deleted or you may not have access.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadBoard(); }, [workspaceId, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (board) {
      addRecentBoard({
        id: board.id,
        name: board.name,
        workspaceId,
        workspaceName: '',
      });
    }
  }, [board, workspaceId]);

  async function handleUpdateBoard() {
    try {
      const updated = await boardsApi.update(workspaceId, boardId, {
        name: boardName.trim() || undefined,
        description: boardDesc.trim() || null,
      });
      setBoard(updated);
      setEditingBoard(false);
    } catch {
      toast.error('Failed to update board. Please try again.');
    }
  }

  async function handleArchiveBoard() {
    try {
      await boardsApi.archive(workspaceId, boardId);
      router.push(`/workspaces/${workspaceId}/boards`);
    } catch {
      toast.error('Failed to archive board. Please try again.');
    }
  }

  async function handleUnarchiveBoard() {
    try {
      await boardsApi.unarchive(workspaceId, boardId);
      if (board) setBoard({ ...board, status: 'ACTIVE', archivedAt: null });
    } catch {
      toast.error('Failed to unarchive board. Please try again.');
    }
  }

  async function handleDeleteBoard() {
    setConfirmDelete(false);
    try {
      await boardsApi.delete(workspaceId, boardId);
      router.push(`/workspaces/${workspaceId}/boards`);
    } catch {
      toast.error('Failed to delete board. Please try again.');
    }
  }

  async function handleCreateColumn() {
    if (!newColName.trim()) return;
    try {
      const col = await boardsApi.createColumn(workspaceId, boardId, { name: newColName.trim() });
      setColumns((prev) => [...prev, col]);
      setNewColName('');
      setAddingList(false);
    } catch {
      toast.error('Failed to create column. Please try again.');
    }
  }

  async function handleUpdateColumn(colId: string) {
    if (!editingColName.trim()) return;
    try {
      const updated = await boardsApi.updateColumn(workspaceId, boardId, colId, { name: editingColName.trim() });
      setColumns((prev) => prev.map((c) => (c.id === colId ? updated : c)));
      setEditingColId(null);
    } catch {
      toast.error('Failed to update column. Please try again.');
    }
  }

  async function handleArchiveColumn(colId: string) {
    try {
      await boardsApi.archiveColumn(workspaceId, boardId, colId);
      setColumns((prev) => prev.filter((c) => c.id !== colId));
      setTasks((prev) => prev.filter((t) => t.columnId !== colId));
    } catch {
      toast.error('Failed to archive column. Please try again.');
    }
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

  function handleDragStart() {
    /* drag started */
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    const overTask = tasks.find((t) => t.id === over.id);

    if (!activeTask) return;

    // Same column — reorder
    if (overTask && activeTask.columnId === overTask.columnId) {
      const colTasks = tasks
        .filter((t) => t.columnId === activeTask.columnId)
        .sort((a, b) => a.position - b.position);
      const oldIdx = colTasks.findIndex((t) => t.id === active.id);
      const newIdx = colTasks.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

      const reordered = arrayMove(colTasks, oldIdx, newIdx);
      setTasks((prev) =>
        prev.map((t) => {
          const found = reordered.findIndex((r) => r.id === t.id);
          return found !== -1 ? { ...t, position: found } : t;
        }),
      );
      await tasksApi.move(workspaceId, boardId, active.id as string, {
        columnId: activeTask.columnId,
        position: newIdx,
      }).catch(() => loadBoard());
    } else {
      // Move to different column
      const targetColumnId = overTask ? overTask.columnId : (over.id as string);
      const targetTasks = tasks.filter((t) => t.columnId === targetColumnId);
      const newPosition = targetTasks.length;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === active.id ? { ...t, columnId: targetColumnId, position: newPosition } : t,
        ),
      );
      await tasksApi.move(workspaceId, boardId, active.id as string, {
        columnId: targetColumnId,
        position: newPosition,
      }).catch(() => loadBoard());
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-red-400">{error}</p>
        <button
          onClick={() => loadBoard()}
          className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex flex-col gap-3 border-b border-surface-800 px-8 py-4">
          <SkeletonBlock className="h-3 w-56 rounded" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SkeletonBlock className="h-5 w-48 rounded" />
              <SkeletonBlock className="mt-1 h-3 w-32 rounded" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-8 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        </header>
        <div className="flex flex-1 gap-4 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-72 shrink-0 space-y-3">
              <SkeletonBlock className="h-1 rounded-xl" />
              <div className="flex items-center justify-between px-4 py-3">
                <SkeletonBlock className="h-4 w-24 rounded" />
                <SkeletonBlock className="h-4 w-6 rounded" />
              </div>
              <div className="space-y-2 px-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <SkeletonCard key={j} className="h-16" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!board) return null;

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  const colOptions = sortedColumns.map((c) => ({ id: c.id, name: c.name }));

  const visibleTasks = tasks.filter((task) => task.title.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-surface-950">
      <BoardToolbar
        board={board} workspaceId={workspaceId} workspaceName={workspace?.name || 'Workspace'}
        calendar={showCalendar} comments={showComments} search={search} onSearch={setSearch} onView={setShowCalendar}
        onComments={() => { setShowComments(!showComments); setShowFiles(false); }}
        onFiles={() => { setShowFiles(true); setShowComments(false); }}
        onSummary={() => setShowAiSummary(true)} onIdeas={() => setShowAiIdeas(true)}
        onEdit={() => { setEditingBoard(true); setBoardName(board.name); setBoardDesc(board.description || ''); }}
        onArchive={board.archivedAt ? handleUnarchiveBoard : handleArchiveBoard} onDelete={() => setConfirmDelete(true)}
      />
      {search.trim() && <p role="status" className="border-b border-surface-800 px-4 py-2 text-xs text-surface-500 sm:px-6">{visibleTasks.length} matching task{visibleTasks.length !== 1 ? 's' : ''} · Clear search to drag tasks between lists.</p>}
      {editingBoard && (
        <form onSubmit={(event) => { event.preventDefault(); void handleUpdateBoard(); }} className="space-y-3 border-b border-surface-800 bg-surface-900 px-4 py-4 sm:px-6">
          <label className="block text-xs text-surface-400">Board name<input autoFocus required maxLength={128} value={boardName} onChange={(event) => setBoardName(event.target.value)} className="mt-1 block w-full max-w-lg rounded-lg border border-surface-700 bg-surface-950 p-2 text-sm text-surface-200" /></label>
          <label className="block text-xs text-surface-400">Description<textarea value={boardDesc} onChange={(event) => setBoardDesc(event.target.value)} className="mt-1 block w-full max-w-lg rounded-lg border border-surface-700 bg-surface-950 p-2 text-sm text-surface-200" /></label>
          <div className="flex gap-2"><button className="rounded-lg bg-primary-600 px-3 py-2 text-xs text-white">Save changes</button><button type="button" onClick={() => setEditingBoard(false)} className="rounded-lg px-3 py-2 text-xs text-surface-400 hover:bg-surface-800">Cancel</button></div>
        </form>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col lg:flex-row">
        {showCalendar ? (
          <div className="flex-1 overflow-y-auto p-6">
            <CalendarView
              tasks={visibleTasks}
              columns={columns}
              onEditTask={(task) => setModal({ type: 'edit', task })}
            />
          </div>
        ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div aria-label="Board task lists" className="flex min-w-0 flex-1 items-start gap-3 overflow-x-auto p-4 pb-8 scroll-smooth sm:p-6">
          {sortedColumns.map((col) => {
            const colTasks = visibleTasks
              .filter((t) => t.columnId === col.id)
              .sort((a, b) => a.position - b.position);

            return (
              <BoardListSurface key={col.id} id={col.id} name={col.name}>
                <div className="flex items-center justify-between gap-2 px-3 py-3">
                  {editingColId === col.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editingColName}
                        onChange={(e) => setEditingColName(e.target.value)}
                        className="w-28 rounded border border-surface-700 bg-surface-800 px-1.5 py-0.5 text-xs outline-none focus:border-primary-500/50"
                        autoFocus
                      />
                      <button aria-label="Save list name" onClick={() => handleUpdateColumn(col.id)} className="text-emerald-400">
                        <Check size={12} />
                      </button>
                      <button aria-label="Cancel renaming list" onClick={() => setEditingColId(null)} className="text-surface-500">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="break-words text-[13px] font-semibold text-surface-300">{col.name}</h2>
                      <span className="text-xs text-surface-500">
                        {colTasks.length}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <details name="board-list-actions" className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
                      <summary aria-label={`Actions for ${col.name}`} className="cursor-pointer list-none rounded-md p-1.5 text-surface-500 hover:bg-surface-800 hover:text-surface-200 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={16} /></summary>
                      <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-surface-700 bg-surface-900 p-1 shadow-xl" onClick={(event) => { const details = event.currentTarget.closest('details'); if (details) details.open = false; }}>
                        <button onClick={() => { setEditingColId(col.id); setEditingColName(col.name); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-surface-300 hover:bg-surface-800"><Pencil size={12} />Rename list</button>
                        <button onClick={() => handleArchiveColumn(col.id)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-surface-400 hover:bg-surface-800"><X size={12} />Archive list</button>
                      </div>
                    </details>
                  </div>
                </div>

                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="min-h-8 space-y-2 px-2 pb-2">
                    {colTasks.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-surface-600">
                        {search ? 'No matching tasks' : 'Drop a task here'}
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          disableDrag={Boolean(search.trim())}
                          onClick={() => setModal({ type: 'edit', task })}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>

                <div className="px-2 pb-2">
                  <button
                    onClick={() => setModal({ type: 'create', columnId: col.id })}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
                  >
                    <Plus size={12} />
                    Add task
                  </button>
                </div>
              </BoardListSurface>
            );
          })}

          <div className="w-[min(18rem,calc(100vw-3rem))] shrink-0">
            {addingList ? <form onSubmit={(event) => { event.preventDefault(); void handleCreateColumn(); }} className="rounded-xl border border-surface-700 bg-surface-900 p-3">
              <input
                aria-label="List name"
                autoFocus
                maxLength={128}
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Enter list name…"
                className="w-full rounded-lg border border-surface-700 bg-surface-950 p-2 text-xs outline-none placeholder:text-surface-600 focus:border-primary-500/50"
              />
              <div className="mt-2 flex items-center gap-2"><button disabled={!newColName.trim()} className="rounded-lg bg-primary-600 px-3 py-2 text-xs text-white disabled:opacity-40">Add list</button><button type="button" aria-label="Cancel adding list" onClick={() => { setAddingList(false); setNewColName(''); }} className="rounded-lg p-2 text-surface-400 hover:bg-surface-800"><X size={16} /></button></div>
            </form> : <button onClick={() => setAddingList(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-surface-800 bg-surface-900/40 p-3 text-xs text-surface-400 hover:border-surface-600 hover:bg-surface-900"><Plus size={15} />Add another list</button>}
          </div>
        </div>
        </DndContext>
        )}
        {showFiles && (
          <WorkbenchSidePanel name={`board:${boardId}:files`} label="Resize board files"><BoardFileSidebar workspaceId={workspaceId} boardId={boardId} onClose={() => setShowFiles(false)} /></WorkbenchSidePanel>
        )}
        {showComments && (
          <WorkbenchSidePanel name={`board:${boardId}:comments`} label="Resize board comments">
            <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3 text-xs text-surface-400">Board comments<button aria-label="Close comments" onClick={() => setShowComments(false)} className="rounded p-1 hover:bg-surface-800"><X size={14} /></button></div>
            <CommentsPanel boardId={boardId} />
          </WorkbenchSidePanel>
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

      {showAiSummary && <AiSummarizePanel boardId={boardId} onClose={() => setShowAiSummary(false)} />}
      {showAiIdeas && (
        <AiIdeasDialog
          onClose={() => setShowAiIdeas(false)}
          onCreateIdea={async (title) => {
            try {
              const task = await tasksApi.create(workspaceId, boardId, columns[0]?.id || '', { title });
              setTasks(prev => [...prev, task]);
            } catch {
              toast.error('Failed to create task from idea. Please try again.');
            }
          }}
        />
      )}
      <ConfirmModal
        open={confirmDelete}
        title="Delete this board?"
        description="This cannot be undone. All tasks, columns, and files in this board will be permanently removed."
        confirmLabel="Delete board"
        variant="danger"
        onConfirm={handleDeleteBoard}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
