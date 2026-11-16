import React, { useEffect, useState } from 'react';
import { X, Clock, MapPin } from 'lucide-react';
import { DAY_LABELS } from '../data/preloadedTimetable';
import type { ClassEntry, TimeSlotDef } from '../types/timetable';
import { formatTimeRange } from '../utils/timetableLogic';

interface ClassDetailSheetProps {
  entry: ClassEntry | null;
  slot: TimeSlotDef | null;
  onClose: () => void;
  onSave: (patch: {
    courseName: string;
    courseCode: string;
    room: string;
    teacher: string;
    notes: string;
  }) => void;
}

export const ClassDetailSheet: React.FC<ClassDetailSheetProps> = ({
  entry,
  slot,
  onClose,
  onSave,
}) => {
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (entry) {
      setCourseName(entry.courseName);
      setCourseCode(entry.courseCode);
      setRoom(entry.room);
      setTeacher(entry.teacher);
      setNotes(entry.notes);
    }
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [entry, onClose]);

  if (!entry || !slot) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      courseName: courseName.trim(),
      courseCode: courseCode.trim(),
      room: room.trim(),
      teacher: teacher.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--accent-text)]">
              {DAY_LABELS[entry.day]} · {slot.label} · Slot {entry.slotCode}
            </p>
            <h2
              id="class-sheet-title"
              className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100 truncate"
            >
              {courseName.trim() || courseCode.trim() || `Slot ${entry.slotCode}`}
            </h2>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {formatTimeRange(slot.startTime, slot.endTime)}
              </span>
              {room.trim() && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  {room.trim()}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close class details"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-[var(--bg-surface-muted)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label
              htmlFor="input-course-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Course name
            </label>
            <input
              id="input-course-name"
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder={
                entry.courseCode
                  ? `Optional display name for ${entry.courseCode}`
                  : `Rename slot ${entry.slotCode} (e.g. Linear Algebra)`
              }
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]/35 focus:border-[var(--accent-solid)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-course-code"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Course code
              </label>
              <input
                id="input-course-code"
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. ASE2009-LP"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]/35 focus:border-[var(--accent-solid)]"
              />
            </div>

            <div>
              <label
                htmlFor="input-room"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Room
              </label>
              <input
                id="input-room"
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. AR-103"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]/35 focus:border-[var(--accent-solid)]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="input-teacher"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Teacher / Instructor
            </label>
            <input
              id="input-teacher"
              type="text"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="e.g. Dr. Nair"
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]/35 focus:border-[var(--accent-solid)]"
            />
          </div>

          <div>
            <label
              htmlFor="input-notes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Notes
            </label>
            <textarea
              id="input-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bring lab manual, quiz topics, syllabus notes..."
              className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]/35 focus:border-[var(--accent-solid)] resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-[var(--bg-surface-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] cursor-pointer"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
