'use client';

import type { Task } from '@/lib/tasks';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, CheckCircle2, UserRound } from 'lucide-react';

type Props = {
  task: Task;
  onClick: () => void;
  disableDrag?: boolean;
};

export function SortableTaskCard({ task, onClick, disableDrag = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: disableDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const done = task.status === 'DONE';
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && !done && due.getTime() < Date.now();
  const priorityColor = task.priority === 'CRITICAL' ? 'bg-red-500/15 text-red-400' : task.priority === 'HIGH' ? 'bg-orange-500/15 text-orange-400' : task.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' : 'bg-sky-500/10 text-sky-400';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !isDragging) {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        } else {
          listeners?.onKeyDown?.(event);
        }
      }}
      aria-disabled={false}
      aria-label={`Open task: ${task.title}`}
      className={`cursor-pointer rounded-lg border border-surface-700/70 bg-surface-800/60 px-3 py-3 shadow-sm transition-colors hover:border-surface-500 hover:bg-surface-800 focus-visible:outline-2 focus-visible:outline-primary-400 ${isDragging ? 'ring-2 ring-primary-500/50' : ''}`}
    >
      {task.priority !== 'NONE' && <span className={`mb-2 inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${priorityColor}`}>{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</span>}
      <p className={`break-words text-[13px] leading-relaxed ${done ? 'text-surface-400' : 'text-surface-200'}`}>{task.title}</p>
      {(due || task.assigneeId || done) && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-surface-500">
        {done && <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12} />Done</span>}
        {due && <time dateTime={task.dueDate!} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${overdue ? 'bg-red-500/10 text-red-400' : 'bg-surface-900/60 text-surface-400'}`}><CalendarDays size={11} />{due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}
        {task.assigneeId && <span aria-label="Task has an assignee" title="Assigned task" className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-surface-700 text-surface-300"><UserRound size={11} /></span>}
      </div>}
    </div>
  );
}
