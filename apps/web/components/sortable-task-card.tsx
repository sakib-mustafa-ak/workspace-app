'use client';

import type { Task } from '@/lib/tasks';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Props = {
  task: Task;
  onClick: () => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-surface-800 bg-surface-950 p-3 transition-all hover:border-surface-700 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <p className="text-sm font-medium">{task.title}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-caption font-medium uppercase ${
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
