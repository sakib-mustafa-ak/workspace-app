'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tasksApi, type Task } from '@/lib/tasks';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[];
};

export function CalendarDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchTasks = useCallback(async () => {
    try {
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date, isCurrentMonth: false, tasks: getTasksForDate(date) });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true, tasks: getTasksForDate(date) });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false, tasks: getTasksForDate(date) });
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
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-xl border border-surface-800 bg-surface-900 p-4 text-sm text-surface-400 transition-colors hover:border-surface-700 hover:text-surface-200"
      >
        <Calendar size={16} />
        Calendar
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-surface-800 bg-surface-900 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => navigateMonth(-1)}
              className="rounded-lg p-1 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-sm font-medium text-surface-200">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => navigateMonth(1)}
              className="rounded-lg p-1 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-7 gap-px">
                {weekDays.map((day) => (
                  <div key={day} className="py-1 text-center text-[10px] font-medium text-surface-500">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px">
                {days.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.date)}
                    className={`relative flex h-8 items-center justify-center rounded text-[11px] transition-colors hover:bg-surface-800 ${
                      !day.isCurrentMonth ? 'text-surface-600' : 'text-surface-300'
                    } ${
                      isToday(day.date) ? 'bg-primary-500/20 text-primary-400 font-medium' : ''
                    } ${
                      selectedDate?.getTime() === day.date.getTime() ? 'bg-surface-800 ring-1 ring-primary-500' : ''
                    }`}
                  >
                    {day.date.getDate()}
                    {day.tasks.length > 0 && (
                      <div className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary-400" />
                    )}
                  </button>
                ))}
              </div>

              {selectedDate && selectedDateTasks.length > 0 && (
                <div className="mt-3 border-t border-surface-800 pt-3">
                  <p className="mb-2 text-[10px] font-medium text-surface-500">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="space-y-1">
                    {selectedDateTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="rounded bg-surface-800/50 px-2 py-1">
                        <p className="text-xs text-surface-200">{task.title}</p>
                      </div>
                    ))}
                    {selectedDateTasks.length > 3 && (
                      <p className="text-[10px] text-surface-500">+{selectedDateTasks.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
