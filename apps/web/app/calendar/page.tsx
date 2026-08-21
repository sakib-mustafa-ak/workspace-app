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
    <div className="flex h-full flex-col">
      <header className="border-b border-surface-800 bg-surface-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-primary-400" />
          <h1 className="text-lg font-semibold text-surface-100">Calendar</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
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
                <h2 className="text-lg font-medium text-surface-200">
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
                    className="bg-surface-900 px-2 py-2 text-center text-xs font-medium text-surface-500"
                  >
                    {day}
                  </div>
                ))}

                {days.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.date)}
                    className={`relative min-h-[80px] bg-surface-900 p-2 text-left transition-colors hover:bg-surface-800/50 ${
                      !day.isCurrentMonth ? 'opacity-40' : ''
                    } ${
                      selectedDate?.getTime() === day.date.getTime()
                        ? 'bg-surface-800 ring-1 ring-primary-500'
                        : ''
                    }`}
                  >
                    <div
                      className={`mb-1 text-xs ${
                        isToday(day.date)
                          ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white'
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
                            className="truncate rounded bg-primary-500/20 px-1 py-0.5 text-[10px] text-primary-300"
                          >
                            {task.title}
                          </div>
                        ))}
                        {day.tasks.length > 2 && (
                          <div className="text-[10px] text-surface-500">
                            +{day.tasks.length - 2} more
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

        <div className="w-80 border-l border-surface-800 bg-surface-900/50 p-4">
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
