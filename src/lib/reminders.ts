import type { Reminder } from '@/types/db';

import { formatMinutes, formatTime } from './format';
import { dayKey, TIME_ZONE } from './stats';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export interface ReminderSection {
  key: string;
  kind: 'overdue' | 'today' | 'tomorrow' | 'day';
  /** Due date of the first item, for labelling 'day' sections. */
  date: Date;
  items: Reminder[];
}

/** Open reminders as Overdue / Today / Tomorrow / one section per later day, in time order. */
export function groupReminders(reminders: Reminder[], now: Date, timeZone: string = TIME_ZONE): ReminderSection[] {
  const today = dayKey(now, timeZone);
  const tomorrow = dayKey(new Date(now.getTime() + DAY_MS), timeZone);
  const sections = new Map<string, ReminderSection>();

  const open = reminders
    .filter((r) => !r.done_at)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  for (const r of open) {
    const due = new Date(r.due_at);
    const day = dayKey(due, timeZone);
    const kind =
      due.getTime() < now.getTime() ? 'overdue' : day === today ? 'today' : day === tomorrow ? 'tomorrow' : 'day';
    const key = kind === 'overdue' ? 'overdue' : day;
    const section = sections.get(key) ?? { key, kind, date: due, items: [] };
    section.items.push(r);
    sections.set(key, section);
  }

  return [...sections.values()];
}

export interface ScheduledReminder {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
}

/** Notifications that should be scheduled: open reminders with an alert that hasn't fired yet. */
export function notificationSchedule(reminders: Reminder[], now: Date): ScheduledReminder[] {
  return reminders.flatMap((r) => {
    if (r.done_at || r.notify_before_min == null) return [];
    const due = new Date(r.due_at);
    const fireAt = new Date(due.getTime() - r.notify_before_min * MIN_MS);
    if (fireAt.getTime() <= now.getTime()) return [];
    const lead = r.notify_before_min === 0 ? 'Now' : `In ${formatMinutes(r.notify_before_min)}`;
    return [{ id: r.id, fireAt, title: r.title, body: `${lead} · ${formatTime(due)}` }];
  });
}
