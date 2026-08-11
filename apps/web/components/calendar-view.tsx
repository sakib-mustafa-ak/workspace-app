'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task } from '@/lib/tasks';
import type { BoardColumn } from '@/lib/boards';

type Props = {
  tasks: Task[];
  columns: BoardColumn[];
  onEditTask: (task: Task) => void;
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDue(due: string): string {
  return new Date(due).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function CalendarView({ tasks, columns, onEditTask }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const colName = (id: string) => columns.find((c) => c.id === id)?.name ?? '';

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDay = new Map<number, Task[]>();
  const overdue: Task[] = [];
  const noDate: Task[] = [];
  const today = startOfDay(new Date());

  for (const t of tasks) {
    if (!t.dueDate) {
      noDate.push(t);
      continue;
    }
    const day = startOfDay(new Date(t.dueDate));
    if (day < today) {
      overdue.push(t);
      continue;
    }
    const key = monthKey(new Date(day));
    if (key !== monthKey(cursor)) continue;
    const list = tasksByDay.get(day) ?? [];
    list.push(t);
    tasksByDay.set(day, list);
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d).getTime());
  }
  const todayCell = startOfDay(new Date());
  const thisMonth = monthKey(cursor);
  const otherMonths = tasks.filter(
    (t) =>
      t.dueDate &&
      (() => {
        const day = startOfDay(new Date(t.dueDate));
        const m = monthKey(new Date(day));
        return m !== thisMonth && day >= today && !overdue.includes(t);
      })(),
  );

  const shift = (delta: number) =>
    setCursor(new Date(year, month + delta, 1));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-800 text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => shift(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-800 text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <h2 className="ml-2 text-base font-semibold text-surface-100">
            {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <button
          onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          className="rounded-lg border border-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-surface-800 bg-surface-800">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="bg-surface-900 px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-surface-500">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} className="min-h-24 bg-surface-950" />;
          const list = tasksByDay.get(day) ?? [];
          const isToday = day === todayCell;
          return (
            <div
              key={day}
              className={`flex min-h-24 flex-col gap-1 p-1.5 ${isToday ? 'bg-surface-900' : 'bg-surface-950'}`}
            >
              <span
                className={`self-end rounded px-1 text-[11px] ${isToday ? 'bg-primary-500 font-bold text-white' : 'text-surface-500'}`}
              >
                {new Date(day).getDate()}
              </span>
              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {list.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="rounded-md bg-surface-800 px-1.5 py-1 text-left text-[11px] leading-tight text-surface-200 transition-colors hover:bg-surface-700"
                  >
                    <span className="line-clamp-2">{t.title}</span>
                  </button>
                ))}
                {list.length > 3 && (
                  <span className="px-1 text-[10px] text-surface-500">+{list.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {overdue.length > 0 && (
          <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400">Overdue</h3>
            <ul className="mt-2 space-y-1">
              {overdue.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onEditTask(t)}
                    className="w-full rounded-md px-2 py-1 text-left text-xs text-surface-200 transition-colors hover:bg-surface-800"
                  >
                    {t.title}
                    <span className="text-surface-500"> · {formatDue(t.dueDate!)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {noDate.length > 0 && (
          <section className="rounded-xl border border-surface-800 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500">No due date</h3>
            <ul className="mt-2 space-y-1">
              {noDate.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onEditTask(t)}
                    className="w-full rounded-md px-2 py-1 text-left text-xs text-surface-200 transition-colors hover:bg-surface-800"
                  >
                    {t.title}
                    {colName(t.columnId) && (
                      <span className="text-surface-500"> · {colName(t.columnId)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {otherMonths.length > 0 && (
          <section className="rounded-xl border border-surface-800 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500">Upcoming</h3>
            <ul className="mt-2 space-y-1">
              {otherMonths.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onEditTask(t)}
                    className="w-full rounded-md px-2 py-1 text-left text-xs text-surface-200 transition-colors hover:bg-surface-800"
                  >
                    {t.title}
                    <span className="text-surface-500"> · {formatDue(t.dueDate!)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {overdue.length === 0 && noDate.length === 0 && otherMonths.length === 0 && (
        <p className="rounded-xl border border-dashed border-surface-800 p-6 text-center text-sm text-surface-500">
          {formatDateLong(cursor)} — no tasks with a due date.
        </p>
      )}
    </div>
  );
}