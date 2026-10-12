import type { Area } from '@/types/db';

import { TIME_ZONE } from './stats';

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "2/3" for session floors, "45m/2h" for minute floors. */
export function formatProgress(area: Area, progress: number): string {
  return area.floor_type === 'sessions'
    ? `${progress}/${area.floor_value}`
    : `${formatMinutes(progress)}/${formatMinutes(area.floor_value)}`;
}

/** "14:05" in Athens time. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

/** "Today 14:05", "Yesterday 09:10" or "Mon 12 Oct", in Athens time. */
export function formatLogTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const day = formatDay(date);
  const time = formatTime(date);
  if (day === formatDay(now)) return `Today ${time}`;
  if (day === formatDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `Yesterday ${time}`;
  return day;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String(e.message);
  return 'Something went wrong';
}
