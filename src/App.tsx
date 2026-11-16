import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Settings as SettingsIcon } from 'lucide-react';
import { ClassDetailSheet } from './components/ClassDetailSheet';
import { SettingsScreen } from './components/SettingsScreen';
import { TodayScreen } from './components/TodayScreen';
import { WeekScreen } from './components/WeekScreen';
import {
  createBackupJson,
  loadSettings,
  loadTimetable,
  parseBackupJson,
  resetToPreloadedTimetable,
  saveSettings,
  saveTimetable,
  updateClassEntry,
} from './repository/timetableRepository';
import {
  getPermissionState,
  openExactAlarmSettings,
  registerNotificationTapListener,
  requestNotificationPermission,
  sendTestNotification,
  syncScheduledNotifications,
  type NotificationPermissionState,
} from './services/notificationScheduler';
import type {
  AppSettings,
  ClassEntry,
  DayOfWeek,
  ScheduledReminder,
  TimeSlotDef,
  TimetableMap,
} from './types/timetable';
import {
  buildTimelineForDay,
  getDayOfWeekFromDate,
  getMinutesOfDay,
  getNowNextState,
} from './utils/timetableLogic';

type ActiveTab = 'today' | 'week' | 'settings';

export default function App() {
  const [timetable, setTimetable] = useState<TimetableMap>(() => loadTimetable());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [now, setNow] = useState<Date>(() => new Date());

  const realToday = useMemo(() => getDayOfWeekFromDate(now), [now]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() =>
    getDayOfWeekFromDate(new Date()),
  );
  const [editingTarget, setEditingTarget] = useState<{
    entry: ClassEntry;
    slot: TimeSlotDef;
  } | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>({
    isNativeAndroid: false,
    notifications: 'prompt',
    exactAlarm: 'not-applicable',
  });
  const [scheduledReminders, setScheduledReminders] = useState<ScheduledReminder[]>([]);

  // Live clock tick (15s interval + tab focus sync)
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 15_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Theme & pastel palette application
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-palette',
      settings.accentPalette || 'sage',
    );
  }, [settings.accentPalette]);

  useEffect(() => {
    const applyTheme = () => {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark =
        settings.themeMode === 'dark' ||
        (settings.themeMode === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    };

    applyTheme();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (mq && settings.themeMode === 'system') {
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [settings.themeMode]);

  // Register Service Worker in browser & inspect notification permissions
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore SW registration failure in restricted environments
      });
    }
    void getPermissionState().then(setPermissionState);
  }, []);

  const handleNavigateToday = useCallback(() => {
    setSelectedDay(getDayOfWeekFromDate(new Date()));
    setActiveTab('today');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const switchTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    return registerNotificationTapListener(handleNavigateToday);
  }, [handleNavigateToday]);

  // Reschedule notifications whenever timetable or settings change
  useEffect(() => {
    let active = true;
    void syncScheduledNotifications(timetable, settings, handleNavigateToday).then(
      (plan) => {
        if (active) setScheduledReminders(plan);
      },
    );
    return () => {
      active = false;
    };
  }, [timetable, settings, handleNavigateToday]);

  const nowMinutes = useMemo(() => getMinutesOfDay(now), [now]);
  const isViewingRealToday = selectedDay === realToday;

  const formattedDate = useMemo(() => {
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [now]);

  // Today tab displays ONLY slots that have classes in them (plus Lunch break)
  const timeline = useMemo(
    () =>
      buildTimelineForDay(timetable, selectedDay, nowMinutes, isViewingRealToday, {
        excludeEmptySlots: true,
      }),
    [timetable, selectedDay, nowMinutes, isViewingRealToday],
  );

  const nowNext = useMemo(
    () =>
      getNowNextState(timetable, selectedDay, nowMinutes, isViewingRealToday, {
        excludeEmptySlots: true,
      }),
    [timetable, selectedDay, nowMinutes, isViewingRealToday],
  );

  const handleSaveClassDetail = (patch: {
    courseName: string;
    courseCode: string;
    room: string;
    teacher: string;
    notes: string;
  }) => {
    if (!editingTarget) return;
    const updated = updateClassEntry(
      timetable,
      editingTarget.entry.day,
      editingTarget.entry.slotId,
      patch,
    );
    setTimetable(updated);
    setEditingTarget(null);
  };

  const handleUpdateSettings = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const handleRequestPermission = async () => {
    const nextState = await requestNotificationPermission();
    setPermissionState(nextState);
    const plan = await syncScheduledNotifications(
      timetable,
      settings,
      handleNavigateToday,
    );
    setScheduledReminders(plan);
  };

  const handleOpenExactAlarmSettings = async () => {
    const nextState = await openExactAlarmSettings();
    setPermissionState(nextState);
  };

  const handleSendTestNotification = async () => {
    return sendTestNotification(settings, handleNavigateToday);
  };

  const handleExportJson = () => {
    const json = createBackupJson(timetable, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable-reminder-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (jsonText: string) => {
    const res = parseBackupJson(jsonText, settings);
    if (!res.ok) {
      return { ok: false, message: res.error };
    }
    setTimetable(res.data.timetable);
    saveTimetable(res.data.timetable);
    setSettings(res.data.settings);
    saveSettings(res.data.settings);
    return { ok: true, message: 'Timetable and settings restored from backup.' };
  };

  const handleResetTimetable = () => {
    const fresh = resetToPreloadedTimetable();
    setTimetable(fresh);
  };

  const handleJumpToDayFromWeek = (day: DayOfWeek) => {
    setSelectedDay(day);
    switchTab('today');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-slate-900 dark:text-slate-100">
      {/* Desktop Top Navigation (3-zone contract; Settings icon in Zone 3 houses Backup & Color Settings) */}
      <header className="hidden md:block sticky top-0 z-30 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={handleNavigateToday}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Timetable Reminder
          </button>

          <nav aria-label="Primary navigation" className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => switchTab('today')}
              className={`min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'today'
                  ? 'border-[var(--accent-solid)] text-[var(--accent-text)]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => switchTab('week')}
              className={`min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'week'
                  ? 'border-[var(--accent-solid)] text-[var(--accent-text)]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => switchTab('settings')}
              className={`min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-[var(--accent-solid)] text-[var(--accent-text)]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Settings
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => switchTab('settings')}
              aria-label="Open settings and backup"
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[var(--bg-tint)] border-[var(--border-tint)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-slate-700 dark:text-slate-200 hover:border-[var(--border-tint)]'
              }`}
            >
              <SettingsIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Header */}
      <header className="md:hidden sticky top-0 z-30 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="px-4 h-12 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Timetable Reminder
          </span>
          <div className="flex items-center gap-1">
            {!isViewingRealToday && activeTab === 'today' && (
              <button
                type="button"
                onClick={handleNavigateToday}
                className="text-xs font-semibold text-[var(--accent-text)] px-2.5 py-1.5 rounded-lg"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => switchTab('settings')}
              aria-label="Open settings and backup"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
            >
              <SettingsIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
        {activeTab === 'today' && (
          <TodayScreen
            selectedDay={selectedDay}
            realToday={realToday}
            formattedDate={formattedDate}
            timeline={timeline}
            nowNext={nowNext}
            permissionState={permissionState}
            onSelectDay={setSelectedDay}
            onOpenClassDetail={(item) => {
              if (item.entry) {
                setEditingTarget({ entry: item.entry, slot: item.slot });
              }
            }}
            onRequestPermission={handleRequestPermission}
            onOpenExactAlarmSettings={handleOpenExactAlarmSettings}
            onOpenSettings={() => switchTab('settings')}
            onOpenWeek={() => switchTab('week')}
          />
        )}

        {activeTab === 'week' && (
          <WeekScreen
            timetable={timetable}
            realToday={realToday}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onJumpToDay={handleJumpToDayFromWeek}
            onEditEmptySlot={(entry, slot) => setEditingTarget({ entry, slot })}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            permissionState={permissionState}
            scheduledCount={scheduledReminders.length}
            nextReminder={scheduledReminders[0] ?? null}
            onUpdateSettings={handleUpdateSettings}
            onRequestPermission={handleRequestPermission}
            onOpenExactAlarmSettings={handleOpenExactAlarmSettings}
            onSendTestNotification={handleSendTestNotification}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onResetTimetable={handleResetTimetable}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] pb-safe"
      >
        <div className="grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => switchTab('today')}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium cursor-pointer ${
              activeTab === 'today'
                ? 'text-[var(--accent-text)]'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Clock className="w-5 h-5" aria-hidden="true" />
            <span>Today</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('week')}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium cursor-pointer ${
              activeTab === 'week'
                ? 'text-[var(--accent-text)]'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            <span>Week</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('settings')}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium cursor-pointer ${
              activeTab === 'settings'
                ? 'text-[var(--accent-text)]'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <SettingsIcon className="w-5 h-5" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* Class Detail Edit Sheet */}
      <ClassDetailSheet
        entry={editingTarget?.entry ?? null}
        slot={editingTarget?.slot ?? null}
        onClose={() => setEditingTarget(null)}
        onSave={handleSaveClassDetail}
      />
    </div>
  );
}
