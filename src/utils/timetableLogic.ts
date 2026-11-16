import {
  DAY_LABELS,
  DAYS_OF_WEEK,
  TIME_SLOTS,
  parseTimeToMinutes,
} from '../data/preloadedTimetable';
import type {
  AppSettings,
  ClassEntry,
  DayOfWeek,
  NowNextState,
  ScheduledReminder,
  SlotStatus,
  TimelineItem,
  TimetableBackupPayload,
  TimetableMap,
} from '../types/timetable';

export function getDayOfWeekFromDate(date: Date): DayOfWeek {
  // JS getDay(): 0 = Sunday, 1 = Monday ... 6 = Saturday
  const jsDay = date.getDay();
  const mapping: DayOfWeek[] = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  return mapping[jsDay] ?? 'MONDAY';
}

export function getMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getEntryDisplayTitle(entry: ClassEntry | null): string {
  if (!entry) return '';
  if (entry.courseName.trim()) return entry.courseName.trim();
  if (entry.courseCode.trim()) return entry.courseCode.trim();
  return entry.slotCode;
}

export function isEntryUnnamed(entry: ClassEntry | null): boolean {
  if (!entry) return true;
  return entry.courseName.trim() === '' && entry.courseCode.trim() === '';
}

export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) {
    return `${safe} min`;
  }
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (m === 0) {
    return `${h} hr`;
  }
  return `${h} hr ${m} min`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}

export interface TimelineFilterOptions {
  excludeEmptySlots?: boolean;
}

export function buildTimelineForDay(
  timetable: TimetableMap,
  day: DayOfWeek,
  nowMinutes: number,
  isToday: boolean,
  options: TimelineFilterOptions = {},
): TimelineItem[] {
  const dayEntries = timetable[day] ?? [];
  if (day === 'SUNDAY' || dayEntries.length === 0) {
    return [];
  }

  const entryMap = new Map(dayEntries.map((e) => [e.slotId, e]));

  const fullItems: TimelineItem[] = TIME_SLOTS.map((slot) => {
    const entry = slot.isBreak ? null : entryMap.get(slot.id) ?? null;
    let status: SlotStatus = 'upcoming';

    if (isToday) {
      if (nowMinutes >= slot.endMinutes) {
        status = 'past';
      } else if (nowMinutes >= slot.startMinutes && nowMinutes < slot.endMinutes) {
        status = 'current';
      } else {
        status = 'upcoming';
      }
    }

    return {
      slot,
      entry,
      status,
      displayTitle: slot.isBreak ? slot.label : getEntryDisplayTitle(entry),
      isUnnamedSlot: slot.isBreak ? false : isEntryUnnamed(entry),
    };
  });

  if (!options.excludeEmptySlots) {
    return fullItems;
  }

  const hasAnyClass = fullItems.some((item) => !item.slot.isBreak && !item.isUnnamedSlot);
  if (!hasAnyClass) {
    return [];
  }

  return fullItems.filter((item) => item.slot.isBreak || !item.isUnnamedSlot);
}

function findNextClassDayLabel(
  timetable: TimetableMap,
  currentDay: DayOfWeek,
  excludeEmptySlots = false,
): string | null {
  const startIndex = DAYS_OF_WEEK.indexOf(currentDay);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidateDay = DAYS_OF_WEEK[(startIndex + offset) % 7];
    const entries = timetable[candidateDay] ?? [];
    const hasRelevantClass = excludeEmptySlots
      ? entries.some((entry) => !isEntryUnnamed(entry))
      : entries.length > 0;
    if (hasRelevantClass) {
      return offset === 1 ? 'Tomorrow' : DAY_LABELS[candidateDay];
    }
  }
  return null;
}

/**
 * Computes the Now / Next card state for a given day and current minute-of-day.
 * Handles running classes, lunch break transitions, gaps between classes,
 * end-of-day state, and Sunday / no-classes days cleanly.
 */
export function getNowNextState(
  timetable: TimetableMap,
  day: DayOfWeek,
  nowMinutes: number,
  isToday = true,
  options: TimelineFilterOptions = {},
): NowNextState {
  const excludeEmpty = Boolean(options.excludeEmptySlots);
  const timeline = buildTimelineForDay(timetable, day, nowMinutes, isToday, options);

  if (timeline.length === 0) {
    return {
      mode: 'no-classes',
      currentItem: null,
      nextItem: null,
      minutesRemaining: null,
      minutesUntilNext: null,
      progressPercent: 0,
      nextDayLabel: findNextClassDayLabel(timetable, day, excludeEmpty),
    };
  }

  if (!isToday) {
    const firstClass = timeline.find((item) => !item.slot.isBreak) ?? null;
    return {
      mode: 'upcoming',
      currentItem: null,
      nextItem: firstClass,
      minutesRemaining: null,
      minutesUntilNext: null,
      progressPercent: 0,
      nextDayLabel: DAY_LABELS[day],
    };
  }

  const currentItem = timeline.find((item) => item.status === 'current') ?? null;
  const nextClassItem =
    timeline.find(
      (item) =>
        !item.slot.isBreak &&
        item.slot.startMinutes > nowMinutes,
    ) ?? null;

  if (currentItem && currentItem.slot.isBreak) {
    const minsRemaining = currentItem.slot.endMinutes - nowMinutes;
    const minsUntilNext = nextClassItem
      ? nextClassItem.slot.startMinutes - nowMinutes
      : null;
    const total = currentItem.slot.endMinutes - currentItem.slot.startMinutes;
    const elapsed = nowMinutes - currentItem.slot.startMinutes;
    const progressPercent = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;

    return {
      mode: 'lunch',
      currentItem,
      nextItem: nextClassItem,
      minutesRemaining: minsRemaining,
      minutesUntilNext: minsUntilNext,
      progressPercent,
      nextDayLabel: null,
    };
  }

  if (currentItem && !currentItem.slot.isBreak) {
    const minsRemaining = currentItem.slot.endMinutes - nowMinutes;
    const total = currentItem.slot.endMinutes - currentItem.slot.startMinutes;
    const elapsed = nowMinutes - currentItem.slot.startMinutes;
    const progressPercent = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;

    return {
      mode: 'running',
      currentItem,
      nextItem: nextClassItem,
      minutesRemaining: minsRemaining,
      minutesUntilNext: nextClassItem
        ? nextClassItem.slot.startMinutes - nowMinutes
        : null,
      progressPercent,
      nextDayLabel: null,
    };
  }

  if (nextClassItem) {
    return {
      mode: 'upcoming',
      currentItem: null,
      nextItem: nextClassItem,
      minutesRemaining: null,
      minutesUntilNext: nextClassItem.slot.startMinutes - nowMinutes,
      progressPercent: 0,
      nextDayLabel: null,
    };
  }

  return {
    mode: 'finished',
    currentItem: null,
    nextItem: null,
    minutesRemaining: null,
    minutesUntilNext: null,
    progressPercent: 100,
    nextDayLabel: findNextClassDayLabel(timetable, day, excludeEmpty),
  };
}

export function shouldNotifyItem(
  item: TimelineItem,
  settings: AppSettings,
): boolean {
  if (item.slot.isBreak) {
    return settings.notifyLunch;
  }
  if (item.isUnnamedSlot) {
    return settings.notifyEmptySlots;
  }
  return true;
}

export function formatMorningSummaryBody(
  timetable: TimetableMap,
  day: DayOfWeek,
  settings: AppSettings,
): string {
  const entries = timetable[day] ?? [];
  if (entries.length === 0) {
    return 'No classes scheduled today.';
  }

  const slotMap = new Map(TIME_SLOTS.map((s) => [s.id, s]));
  const items = entries
    .filter((entry) => {
      if (settings.notifyEmptySlots) return true;
      return !isEntryUnnamed(entry);
    })
    .map((entry) => {
      const slot = slotMap.get(entry.slotId);
      const title = getEntryDisplayTitle(entry);
      const roomPart = entry.room.trim() ? ` (${entry.room.trim()})` : '';
      return `${slot?.startTime ?? ''} ${title}${roomPart}`.trim();
    });

  if (items.length === 0) {
    return 'Only open slot codes today. Tap to review your schedule.';
  }

  return items.join(' · ');
}

function stableNotificationId(dayIndex: number, slotIndex: number, kind: 'class' | 'summary'): number {
  const base = kind === 'summary' ? 2000 : 1000;
  return base + dayIndex * 20 + slotIndex;
}

/**
 * Generates upcoming local notifications for the next 7 days starting from `now`.
 */
export function buildNotificationPlan(
  timetable: TimetableMap,
  settings: AppSettings,
  now: Date = new Date(),
): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];
  const nowMs = now.getTime();

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + dayOffset);
    targetDate.setSeconds(0, 0);

    const day = getDayOfWeekFromDate(targetDate);
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    const entries = timetable[day] ?? [];
    if (entries.length === 0) continue;

    // Morning summary
    if (settings.morningSummaryEnabled) {
      const summaryMinutes = parseTimeToMinutes(settings.morningSummaryTime || '07:30');
      const triggerDate = new Date(targetDate);
      triggerDate.setHours(Math.floor(summaryMinutes / 60), summaryMinutes % 60, 0, 0);

      if (triggerDate.getTime() > nowMs) {
        reminders.push({
          id: stableNotificationId(dayIndex, 0, 'summary'),
          kind: 'morning-summary',
          day,
          title: `${DAY_LABELS[day]}'s Class Schedule`,
          body: formatMorningSummaryBody(timetable, day, settings),
          triggerAtMs: triggerDate.getTime(),
          triggerTimeLabel: settings.morningSummaryTime || '07:30',
        });
      }
    }

    // Individual slot reminders
    const timeline = buildTimelineForDay(timetable, day, 0, false);
    timeline.forEach((item, idx) => {
      if (!shouldNotifyItem(item, settings)) return;

      const notifyMinutes = item.slot.startMinutes - settings.leadTimeMinutes;
      const triggerDate = new Date(targetDate);
      triggerDate.setHours(Math.floor(notifyMinutes / 60), notifyMinutes % 60, 0, 0);

      if (triggerDate.getTime() > nowMs) {
        const roomLabel = item.entry?.room.trim()
          ? `Room ${item.entry.room.trim()}`
          : 'No room set';
        const timeStr = `${item.slot.startTime}–${item.slot.endTime}`;
        reminders.push({
          id: stableNotificationId(dayIndex, idx + 1, 'class'),
          kind: 'class',
          day,
          slotId: item.slot.id,
          title: item.displayTitle,
          body: `${timeStr} · ${roomLabel} · starts in ${settings.leadTimeMinutes} min`,
          triggerAtMs: triggerDate.getTime(),
          triggerTimeLabel: `${String(triggerDate.getHours()).padStart(2, '0')}:${String(triggerDate.getMinutes()).padStart(2, '0')}`,
        });
      }
    });
  }

  return reminders.sort((a, b) => a.triggerAtMs - b.triggerAtMs);
}

export function validateBackupPayload(
  raw: unknown,
  fallbackSettings: AppSettings,
): { ok: true; data: TimetableBackupPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid JSON structure.' };
  }
  const obj = raw as Record<string, unknown>;
  const timetable = obj.timetable as Record<string, unknown> | undefined;
  if (!timetable || typeof timetable !== 'object') {
    return { ok: false, error: 'Missing timetable object in backup file.' };
  }

  for (const day of DAYS_OF_WEEK) {
    if (!Array.isArray(timetable[day])) {
      return { ok: false, error: `Missing or invalid entries for ${DAY_LABELS[day]}.` };
    }
  }

  const incomingSettings =
    obj.settings && typeof obj.settings === 'object'
      ? (obj.settings as Partial<AppSettings>)
      : {};

  const mergedSettings: AppSettings = {
    ...fallbackSettings,
    ...incomingSettings,
  };

  return {
    ok: true,
    data: {
      version: 1,
      exportedAt:
        typeof obj.exportedAt === 'string'
          ? obj.exportedAt
          : new Date().toISOString(),
      timetable: timetable as TimetableMap,
      settings: mergedSettings,
    },
  };
}
