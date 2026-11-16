import React, { useRef } from 'react';
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  TIME_SLOTS,
  WEEKDAYS_MON_SAT,
} from '../data/preloadedTimetable';
import type { ClassEntry, DayOfWeek, TimeSlotDef, TimetableMap } from '../types/timetable';
import { getEntryDisplayTitle, isEntryUnnamed } from '../utils/timetableLogic';

interface WeekScreenProps {
  timetable: TimetableMap;
  realToday: DayOfWeek;
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  onJumpToDay: (day: DayOfWeek) => void;
  onEditEmptySlot: (entry: ClassEntry, slot: TimeSlotDef) => void;
}

export const WeekScreen: React.FC<WeekScreenProps> = ({
  timetable,
  realToday,
  selectedDay,
  onSelectDay,
  onJumpToDay,
  onEditEmptySlot,
}) => {
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 56) return;

    const currentIdx = Math.max(0, WEEKDAYS_MON_SAT.indexOf(selectedDay));
    if (delta < 0 && currentIdx < WEEKDAYS_MON_SAT.length - 1) {
      onSelectDay(WEEKDAYS_MON_SAT[currentIdx + 1]);
    } else if (delta > 0 && currentIdx > 0) {
      onSelectDay(WEEKDAYS_MON_SAT[currentIdx - 1]);
    }
  };

  return (
    <div
      className="space-y-5"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Monday – Saturday · Theory Slots 1–7
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Weekly Timetable
          </h1>
        </div>

        {/* Day selector */}
        <div
          role="group"
          aria-label="Jump to day"
          className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-muted)] overflow-x-auto max-w-full"
        >
          {WEEKDAYS_MON_SAT.map((day) => {
            const isHighlighted = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onJumpToDay(day)}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  isHighlighted
                    ? 'bg-[var(--bg-card)] text-[var(--accent-text)] shadow-xs'
                    : day === realToday
                    ? 'text-[var(--accent-text)] hover:bg-white/50 dark:hover:bg-white/5'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {DAY_SHORT_LABELS[day]}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Tap an assigned class or day header to jump to Today view, or tap any open slot code to assign a course.
      </p>

      {/* Compact grid table */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-x-auto shadow-xs">
        <table className="w-full min-w-[740px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)]">
              <th className="py-3 px-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">
                Time
              </th>
              {WEEKDAYS_MON_SAT.map((day) => {
                const isToday = day === realToday;
                const isSelected = day === selectedDay;
                return (
                  <th key={day} className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => onJumpToDay(day)}
                      className={`w-full min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        isToday || isSelected
                          ? 'text-[var(--accent-text)] bg-[var(--bg-tint)]'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-[var(--bg-surface-muted)]'
                      }`}
                    >
                      {DAY_SHORT_LABELS[day]}
                      {isToday ? ' (Today)' : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)]">
            {TIME_SLOTS.map((slot) => {
              if (slot.isBreak) {
                return (
                  <tr
                    key={slot.id}
                    className="bg-amber-50/55 dark:bg-amber-950/20"
                  >
                    <td className="py-2 px-3.5 text-xs font-mono text-amber-800 dark:text-amber-300 tabular-nums whitespace-nowrap">
                      {slot.startTime}–{slot.endTime}
                    </td>
                    <td
                      colSpan={6}
                      className="py-2 px-3 text-center text-xs font-medium text-amber-800 dark:text-amber-300"
                    >
                      Lunch break (5 min)
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={slot.id} className="align-top">
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {slot.label}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {slot.startTime}–{slot.endTime}
                    </div>
                  </td>

                  {WEEKDAYS_MON_SAT.map((day) => {
                    const entry = (timetable[day] ?? []).find(
                      (e) => e.slotId === slot.id,
                    );
                    const title = entry ? getEntryDisplayTitle(entry) : '';
                    const unnamed = entry ? isEntryUnnamed(entry) : true;

                    return (
                      <td key={`${day}-${slot.id}`} className="p-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (unnamed && entry) {
                              onEditEmptySlot(entry, slot);
                            } else {
                              onJumpToDay(day);
                            }
                          }}
                          aria-label={
                            unnamed
                              ? `Assign ${DAY_LABELS[day]} ${slot.label}: ${title}`
                              : `Open ${DAY_LABELS[day]} ${slot.label}: ${title}`
                          }
                          className={`w-full min-h-[54px] rounded-xl px-2.5 py-2 text-left border cursor-pointer ${
                            unnamed
                              ? 'bg-[var(--bg-surface-secondary)] border-[var(--border-subtle)] text-slate-500 dark:text-slate-400 hover:border-[var(--border-tint)]'
                              : 'bg-[var(--bg-tint)] border-[var(--border-tint)] text-slate-900 dark:text-slate-100 hover:opacity-90'
                          }`}
                        >
                          <div className="text-xs font-semibold truncate">
                            {title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                            {entry?.room ? entry.room : entry?.slotCode}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
