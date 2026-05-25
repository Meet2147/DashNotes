'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { useNoteDates } from '@/hooks/useNotes';

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { calendarSelectedDate, setCalendarSelectedDate, setView, setMobilePanel } = useAppStore();
  const noteDates = useNoteDates();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of calendar with empty days
  const startPadding = getDay(monthStart); // 0=Sun, 1=Mon...
  const paddedDays = [...Array(startPadding).fill(null), ...days];

  // Fill end to complete the grid (multiple of 7)
  while (paddedDays.length % 7 !== 0) {
    paddedDays.push(null);
  }

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    if (calendarSelectedDate === dateStr) {
      setCalendarSelectedDate(null);
    } else {
      setCalendarSelectedDate(dateStr);
      setView('calendar');
      setMobilePanel('notes');
    }
  };

  const getDayKey = (day: Date) => format(day, 'yyyy-MM-dd');
  const hasNotes = (day: Date) => noteDates.has(getDayKey(day));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 select-none">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={goToToday}
              className="px-2 py-1 text-xs rounded-md text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 font-medium transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 text-center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="grid grid-cols-7 gap-y-1">
          {paddedDays.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const dateStr = getDayKey(day);
            const isSelected = calendarSelectedDate === dateStr;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const todayDay = isToday(day);
            const hasNote = hasNotes(day);

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all relative
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-violet-600 text-white' : ''}
                  ${todayDay && !isSelected ? 'ring-2 ring-violet-400 ring-offset-1 dark:ring-offset-gray-800' : ''}
                  ${!isSelected && isCurrentMonth ? 'hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-700 dark:text-gray-300' : ''}
                  ${!isSelected && !isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''}
                `}
              >
                {format(day, 'd')}
                {hasNote && (
                  <span
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-violet-500 dark:bg-violet-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {calendarSelectedDate && (
          <div className="mt-4 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
            <p className="text-sm text-violet-700 dark:text-violet-300 font-medium">
              {format(new Date(calendarSelectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">
              {noteDates.has(calendarSelectedDate) ? 'Notes available for this date' : 'No notes for this date'}
            </p>
            <button
              onClick={() => setCalendarSelectedDate(null)}
              className="mt-2 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
