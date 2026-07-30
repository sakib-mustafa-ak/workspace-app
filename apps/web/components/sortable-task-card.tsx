'use client';

import type { Task } from '@/lib/tasks';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Props = {
  task: Task;
  onClick: () => void;
};

const PRIORITY_BORDER: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-orange-500',
  MEDIUM: 'border-l-yellow-500',
  LOW: 'border-l-gray-500',
  NONE: 'border-l-gray-500',
};

export function SortableTaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityBorder = PRIORITY_BORDER[task.priority] || 'border-l-gray-500';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-surface-800 border-l-4 ${priorityBorder} bg-surface-950 p-3 transition-all hover:border-surface-700 hover:-translate-y-0.5 hover:shadow-lg`}
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
  );
}
