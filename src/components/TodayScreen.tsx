import React, { useRef, useState } from 'react';
import { Bell, Clock, Coffee, MapPin, RotateCcw, CalendarOff, ChevronRight, ArrowRight } from 'lucide-react';
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  DAYS_OF_WEEK,
} from '../data/preloadedTimetable';
import type { NotificationPermissionState } from '../services/notificationScheduler';
import type { DayOfWeek, NowNextState, TimelineItem } from '../types/timetable';
import { formatTimeRange } from '../utils/timetableLogic';
import { NowNextCard } from './NowNextCard';

interface TodayScreenProps {
  selectedDay: DayOfWeek;
  realToday: DayOfWeek;
  formattedDate: string;
  timeline: TimelineItem[];
  nowNext: NowNextState;
  permissionState: NotificationPermissionState;
  onSelectDay: (day: DayOfWeek) => void;
  onOpenClassDetail: (item: TimelineItem) => void;
  onRequestPermission: () => void;
  onOpenExactAlarmSettings: () => void;
  onOpenSettings: () => void;
  onOpenWeek: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  selectedDay,
  realToday,
  formattedDate,
  timeline,
  nowNext,
  permissionState,
  onSelectDay,
  onOpenClassDetail,
  onRequestPermission,
  onOpenExactAlarmSettings,
  onOpenSettings,
  onOpenWeek,
}) => {
  const touchStartX = useRef<number | null>(null);
  const [dismissedDeniedNotice, setDismissedDeniedNotice] = useState(false);
  const isViewingRealToday = selectedDay === realToday;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(delta) < 56) return;
    const idx = DAYS_OF_WEEK.indexOf(selectedDay);
    if (delta < 0 && idx < DAYS_OF_WEEK.length - 1) {
      onSelectDay(DAYS_OF_WEEK[idx + 1]);
    } else if (delta > 0 && idx > 0) {
      onSelectDay(DAYS_OF_WEEK[idx - 1]);
    }
  };

  const classCount = timeline.filter((t) => !t.slot.isBreak).length;
  const showDeniedBanner =
    permissionState.notifications === 'denied' && !dismissedDeniedNotice;

  return (
    <div
      className="space-y-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with date, day name, and day selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isViewingRealToday
              ? formattedDate
              : `Viewing schedule · Today is ${DAY_LABELS[realToday]}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {DAY_LABELS[selectedDay]}
            </h1>
            {!isViewingRealToday && (
              <button
                type="button"
                onClick={() => onSelectDay(realToday)}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--accent-text)] bg-[var(--bg-tint)] hover:opacity-90 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Back to Today
              </button>
            )}
          </div>
        </div>

        {/* Day selector tabs (Mon–Sun) */}
        <div
          role="tablist"
          aria-label="Select day of week"
          className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-muted)] overflow-x-auto max-w-full"
        >
          {DAYS_OF_WEEK.map((day) => {
            const active = day === selectedDay;
            const isReal = day === realToday;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={isReal ? `${DAY_LABELS[day]} (Today)` : DAY_LABELS[day]}
                onClick={() => onSelectDay(day)}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[var(--bg-card)] text-slate-900 dark:text-slate-50 shadow-xs'
                    : isReal
                    ? 'text-[var(--accent-text)] hover:bg-white/50 dark:hover:bg-white/5'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {DAY_SHORT_LABELS[day]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Missing permission banner */}
      {(permissionState.notifications === 'prompt' || showDeniedBanner) && (
        <div
          role="region"
          aria-label="Notification permission notice"
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-tint)] flex items-center justify-center shrink-0 text-[var(--accent-text)]">
              <Bell className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {permissionState.notifications === 'denied'
                  ? 'Notifications are currently disabled'
                  : 'Enable class reminder notifications'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {permissionState.notifications === 'denied'
                  ? 'Allow notifications in your device or browser settings to receive alerts before each class.'
                  : 'Get timely reminders before each class and a morning summary at your chosen time.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {permissionState.notifications === 'prompt' ? (
              <button
                type="button"
                onClick={onRequestPermission}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] whitespace-nowrap cursor-pointer"
              >
                Allow notifications
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--accent-text)] bg-[var(--bg-tint)] hover:opacity-90 whitespace-nowrap cursor-pointer"
                >
                  Reminder settings
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedDeniedNotice(true)}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-[var(--bg-surface-muted)] whitespace-nowrap cursor-pointer"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {permissionState.isNativeAndroid &&
        permissionState.notifications === 'granted' &&
        permissionState.exactAlarm === 'denied' && (
          <div
            role="region"
            aria-label="Exact alarm permission notice"
            className="rounded-2xl bg-[var(--bg-card)] border border-amber-200 dark:border-amber-800/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Exact alarm permission recommended
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Android requires exact alarm access so your class reminders fire right on time even in battery saver mode.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenExactAlarmSettings}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Allow exact alarms
            </button>
          </div>
        )}

      {/* Unified empty state when day has no assigned classes */}
      {timeline.length === 0 ? (
        <div
          data-testid="empty-day-state"
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tint)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
            <CalendarOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            No classes on {DAY_LABELS[selectedDay]}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            {selectedDay === 'SUNDAY'
              ? isViewingRealToday && nowNext.nextDayLabel
                ? `Enjoy your day off. Classes resume ${nowNext.nextDayLabel}.`
                : 'Sunday is free from scheduled lectures and labs.'
              : `No courses are assigned to ${DAY_LABELS[selectedDay]}'s slots yet. Open Week view to assign any slot.`}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {selectedDay !== 'MONDAY' && (
              <button
                type="button"
                onClick={() => onSelectDay('MONDAY')}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] cursor-pointer"
              >
                View Monday&apos;s classes
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenWeek}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium bg-[var(--bg-surface-secondary)] text-slate-800 dark:text-slate-100 border border-[var(--border-subtle)] hover:opacity-90 cursor-pointer"
            >
              Open Week view
            </button>
          </div>
        </div>
      ) : (
        /* Main responsive 2-column grid on desktop, single column on mobile */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column: Now/Next Card & Summary */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
            <NowNextCard
              nowNext={nowNext}
              isViewingRealToday={isViewingRealToday}
              dayLabel={DAY_LABELS[selectedDay]}
              onSelectClass={onOpenClassDetail}
              onJumpToMonday={
                selectedDay === 'SUNDAY' ? () => onSelectDay('MONDAY') : undefined
              }
            />

            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-5 py-4 flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {DAY_LABELS[selectedDay]} classes
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                {classCount} {classCount === 1 ? 'class' : 'classes'} today
              </span>
            </div>
          </div>

          {/* Right column: Vertical Timeline (assigned classes + Lunch only) */}
          <div className="lg:col-span-7">
            <ol
              aria-label={`${DAY_LABELS[selectedDay]} timeline`}
              className="space-y-2.5"
              data-testid="day-timeline"
            >
              {timeline.map((item) => {
                const isPast = item.status === 'past';
                const isCurrent = item.status === 'current';

                if (item.slot.isBreak) {
                  return (
                    <li key={item.slot.id}>
                      <div
                        className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-amber-50/85 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
                            : 'bg-[var(--bg-surface-secondary)] border-[var(--border-subtle)]'
                        } ${isPast ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Coffee
                            className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              Lunch break
                              {isCurrent ? ' · Now' : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {formatTimeRange(item.slot.startTime, item.slot.endTime)}
                        </span>
                      </div>
                    </li>
                  );
                }

                const entry = item.entry!;
                const hasCustomName = entry.courseName.trim() !== '';
                const secondaryCode =
                  hasCustomName && entry.courseCode.trim()
                    ? `${entry.courseCode.trim()} · Slot ${entry.slotCode}`
                    : `Slot ${entry.slotCode}`;

                return (
                  <li key={item.slot.id}>
                    <button
                      type="button"
                      onClick={() => onOpenClassDetail(item)}
                      className={`w-full text-left rounded-2xl p-4 sm:px-5 sm:py-4 border cursor-pointer flex items-center justify-between gap-4 min-h-[68px] ${
                        isCurrent
                          ? 'bg-[var(--bg-tint)] border-[var(--border-tint)] shadow-xs'
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--border-tint)]'
                      } ${isPast ? 'opacity-60' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span className="inline-flex items-center gap-1 font-mono font-medium text-slate-700 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            {formatTimeRange(item.slot.startTime, item.slot.endTime)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{secondaryCode}</span>
                          {isCurrent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[var(--accent-text)]">
                                Now
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                          <span className="text-base font-semibold truncate text-slate-900 dark:text-slate-100">
                            {item.displayTitle}
                          </span>
                        </div>

                        {(entry.room || entry.teacher || entry.notes) && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {entry.room && (
                              <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                {entry.room}
                              </span>
                            )}
                            {entry.teacher && (
                              <>
                                {entry.room && <span aria-hidden="true">·</span>}
                                <span>{entry.teacher}</span>
                              </>
                            )}
                            {entry.notes && (
                              <>
                                {(entry.room || entry.teacher) && <span aria-hidden="true">·</span>}
                                <span className="truncate max-w-[240px]">{entry.notes}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <ChevronRight
                        className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
