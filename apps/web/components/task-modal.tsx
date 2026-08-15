'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { X, Trash2, Plus, Check, Square } from 'lucide-react';
import { tasksApi, type Task, type CreateTaskData } from '@/lib/tasks';
import { checklistApi, type ChecklistItem } from '@/lib/checklist';
import { workspacesApi, type WorkspaceMember } from '@/lib/workspaces';

export type TaskModalMode = 'create' | 'edit';

type Props = {
  mode: TaskModalMode;
  task?: Task | null;
  workspaceId: string;
  boardId: string;
  columnId?: string;
  columns?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
};

export function TaskModal({
  mode,
  task,
  workspaceId,
  boardId,
  columnId: initialColumnId,
  columns,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || '');
  const [dueDate, setDueDate] = useState(task?.dueDate?.split('T')[0] || '');
  const [columnId, setColumnId] = useState(initialColumnId || task?.columnId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  useEffect(() => {
    Promise.all([
      workspacesApi.getMembers(workspaceId).then(setMembers).catch(() => {}),
      mode === 'edit' && task ? checklistApi.list(workspaceId, boardId, task.id).then(setChecklist).catch(() => {}) : Promise.resolve(),
    ]);
  }, [workspaceId, boardId, task, mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'create') {
        const data: CreateTaskData = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assigneeId: assigneeId || undefined,
          dueDate: dueDate || undefined,
        };
        const created = await tasksApi.create(workspaceId, boardId, columnId, data);
        onSaved(created);
      } else if (task) {
        const updated = await tasksApi.update(workspaceId, boardId, task.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
        });
        onSaved(updated);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!task || !onDeleted) return;
    if (!confirm('Delete this task?')) return;
    try {
      await tasksApi.delete(workspaceId, boardId, task.id);
      onDeleted(task.id);
      onClose();
    } catch { /* handled */ }
  }

  async function handleMoveColumn(newColumnId: string) {
    if (!task) return;
    try {
      const updated = await tasksApi.move(workspaceId, boardId, task.id, { columnId: newColumnId });
      onSaved(updated);
      setColumnId(newColumnId);
    } catch { /* handled */ }
  }

  async function handleAddChecklist() {
    if (!newChecklistText.trim() || !task) return;
    try {
      const item = await checklistApi.create(workspaceId, boardId, task.id, { text: newChecklistText.trim() });
      setChecklist(prev => [...prev, item]);
      setNewChecklistText('');
    } catch { /* handled */ }
  }

  async function handleToggleChecklist(item: ChecklistItem) {
    if (!task) return;
    try {
      const updated = await checklistApi.update(workspaceId, boardId, task.id, item.id, { completed: !item.completed });
      setChecklist(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch { /* handled */ }
  }

  async function handleDeleteChecklist(itemId: string) {
    if (!task) return;
    try {
      await checklistApi.delete(workspaceId, boardId, task.id, itemId);
      setChecklist(prev => prev.filter(i => i.id !== itemId));
    } catch { /* handled */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-surface-800 bg-surface-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
          <h2 className="text-sm font-semibold">
            {mode === 'create' ? 'Create task' : 'Edit task'}
          </h2>
          <button onClick={onClose} title="Close" aria-label="Close" className="text-surface-500 hover:text-surface-300">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1 text-surface-400">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-surface-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-surface-400">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="NONE">None</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-surface-400">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-surface-400">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.userId}>
                  {m.user?.displayName || m.user?.email || m.userId}
                </option>
              ))}
            </select>
          </div>

          {mode === 'edit' && columns && columns.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1 text-surface-400">Move to column</label>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleMoveColumn(c.id)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      c.id === columnId
                        ? 'bg-primary-600/20 text-primary-400'
                        : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'edit' && task && (
            <div>
              <label className="block text-xs font-medium mb-1 text-surface-400">Checklist</label>
              <div className="space-y-1">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-surface-800">
                    <button type="button" onClick={() => handleToggleChecklist(item)} className="text-surface-500 hover:text-primary-400">
                      {item.completed ? <Check size={12} className="text-green-400" /> : <Square size={12} />}
                    </button>
                    <span className={`flex-1 ${item.completed ? 'text-surface-500 line-through' : 'text-surface-300'}`}>
                      {item.text}
                    </span>
                    <button type="button" onClick={() => handleDeleteChecklist(item.id)} className="text-surface-600 hover:text-red-400">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Add item..."
                  className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-2 py-1 text-xs outline-none focus:border-primary-500"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklist())}
                />
                <button type="button" onClick={handleAddChecklist} disabled={!newChecklistText.trim()} className="rounded p-1 text-surface-500 hover:text-primary-400 disabled:opacity-30">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {mode === 'edit' && onDeleted && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={12} />
                Delete
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-surface-700 px-4 py-2 text-xs text-surface-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50"
              >
                {submitting ? 'Saving\u2026' : mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
