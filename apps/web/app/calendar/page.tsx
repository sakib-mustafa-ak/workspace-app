'use client';

import { useState, useEffect, useCallback } from 'react';
import { tasksApi, type Task } from '@/lib/tasks';
import { Calendar } from 'lucide-react';

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[];
};

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const allTasks = await tasksApi.listByUser(1000);
      setTasks(allTasks.filter((t) => t.dueDate));
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        tasks: getTasksForDate(date),
      });
    }

    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        tasks: getTasksForDate(date),
      });
    }

    // Add days from next month
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        tasks: getTasksForDate(date),
      });
    }

    return days;
  };

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getFullYear() === date.getFullYear() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getDate() === date.getDate()
      );
    });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="relative flex h-full flex-col">
      {/* Desktop background */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/bg-desktop.jpeg)' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-surface-950/87" />
      {/* Mobile background */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat sm:hidden"
        style={{ backgroundImage: 'url(/bg-mobile.jpeg)' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-surface-950/87 sm:hidden" />
      <header className="border-b border-surface-800 bg-surface-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-primary-400" />
          <h1 className="text-lg font-semibold text-surface-100">Calendar</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="rounded-lg px-3 py-1.5 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
                >
                  Previous
                </button>
                <h2 className="text-base font-medium text-surface-200 sm:text-lg">
                  {currentDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
                <button
                  onClick={() => navigateMonth(1)}
                  className="rounded-lg px-3 py-1.5 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
                >
                  Next
                </button>
              </div>

              <div className="grid grid-cols-7 gap-px rounded-lg border border-surface-800 bg-surface-800">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="bg-surface-900 px-1 py-1.5 text-center text-[10px] font-medium text-surface-500 sm:px-2 sm:py-2 sm:text-xs"
                  >
                    {day}
                  </div>
                ))}

                {days.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.date)}
                    className={`relative min-h-[50px] bg-surface-900 p-1 text-left transition-colors hover:bg-surface-800/50 sm:min-h-[80px] sm:p-2 ${
                      !day.isCurrentMonth ? 'opacity-40' : ''
                    } ${
                      selectedDate?.getTime() === day.date.getTime()
                        ? 'bg-surface-800 ring-1 ring-primary-500'
                        : ''
                    }`}
                  >
                    <div
                      className={`mb-0.5 text-[10px] sm:mb-1 sm:text-xs ${
                        isToday(day.date)
                          ? 'flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-white sm:h-5 sm:w-5'
                          : 'text-surface-400'
                      }`}
                    >
                      {day.date.getDate()}
                    </div>
                    {day.tasks.length > 0 && (
                      <div className="space-y-0.5">
                        {day.tasks.slice(0, 2).map((task) => (
                          <div
                            key={task.id}
                            className="hidden truncate rounded bg-primary-500/20 px-1 py-0.5 text-[9px] text-primary-300 sm:block sm:text-[10px]"
                          >
                            {task.title}
                          </div>
                        ))}
                        {day.tasks.length > 0 && (
                          <div className="text-[8px] text-surface-500 sm:text-[10px]">
                            {day.tasks.length > 2 ? `+${day.tasks.length - 2}` : day.tasks.length === 1 ? '' : day.tasks.length}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="w-full border-t border-surface-800 bg-surface-900/50 p-4 sm:w-80 sm:border-l sm:border-t-0 lg:w-80">
          <h3 className="mb-3 text-sm font-medium text-surface-300">
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h3>
          {selectedDate && (
            <div className="space-y-2">
              {selectedDateTasks.length === 0 ? (
                <p className="text-xs text-surface-500">No tasks due</p>
              ) : (
                selectedDateTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-surface-800 bg-surface-800/50 p-3"
                  >
                    <p className="text-sm text-surface-200">{task.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          task.status === 'DONE'
                            ? 'bg-green-500/20 text-green-400'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-surface-700 text-surface-300'
                        }`}
                      >
                        {task.status}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          task.priority === 'HIGH'
                            ? 'bg-red-500/20 text-red-400'
                            : task.priority === 'MEDIUM'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-surface-700 text-surface-300'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
