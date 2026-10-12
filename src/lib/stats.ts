import type { Area, Log } from '@/types/db';

export const TIME_ZONE = 'Europe/Athens';
export const NEGLECT_DAYS = 5;
export const DOMINANCE_SHARE = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// ---------------------------------------------------------------------------
// Time zone helpers (Intl only, no date library)
// ---------------------------------------------------------------------------

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // Mon = 0 … Sun = 6
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAY_INDEX[get('weekday')],
  };
}

/** Offset of `timeZone` from UTC at `date`, in ms (e.g. +3h for Athens in summer). */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight on the given calendar day in `timeZone`. */
function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Correct once if the offset at the result differs (DST change between guess and result).
  const offset = zoneOffsetMs(new Date(result), timeZone);
  if (guess - offset !== result) result = guess - offset;
  return new Date(result);
}

/** Calendar day in `timeZone` as YYYY-MM-DD. */
export function dayKey(date: Date, timeZone: string = TIME_ZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Current week as [start, end): Monday 00:00 to next Monday 00:00 in `timeZone`. */
export function weekBounds(now: Date, timeZone: string = TIME_ZONE): { start: Date; end: Date } {
  const p = zonedParts(now, timeZone);
  // Date.UTC normalises day overflow/underflow across months and years.
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday));
  const nextMonday = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday + 7));
  return {
    start: zonedMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timeZone),
    end: zonedMidnight(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth() + 1,
      nextMonday.getUTCDate(),
      timeZone,
    ),
  };
}

/** Earliest instant the Week tab needs logs from: this week's start or the neglect window. */
export function statsWindowStart(now: Date, timeZone: string = TIME_ZONE): Date {
  const { start } = weekBounds(now, timeZone);
  const neglectStart = new Date(now.getTime() - NEGLECT_DAYS * DAY_MS);
  return start < neglectStart ? start : neglectStart;
}

// ---------------------------------------------------------------------------
// Week stats
// ---------------------------------------------------------------------------

export interface AreaWeekStats {
  area: Area;
  sessions: number;
  minutes: number;
  /** Sessions or minutes, depending on the area's floor type. */
  progress: number;
  /** progress / floor_value, capped at 1. */
  floorRatio: number;
  floorMet: boolean;
  /** Share of this week's total logged minutes, 0-1. */
  share: number;
  /** Average energy over logs that have one, or null. */
  avgEnergy: number | null;
}

export interface WeekStats {
  start: Date;
  end: Date;
  totalMinutes: number;
  areas: AreaWeekStats[];
}

export function computeWeekStats(
  areas: Area[],
  logs: Log[],
  now: Date,
  timeZone: string = TIME_ZONE,
): WeekStats {
  const { start, end } = weekBounds(now, timeZone);
  const weekLogs = logs.filter((l) => {
    const t = new Date(l.logged_at).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  const totalMinutes = weekLogs.reduce((sum, l) => sum + l.duration_min, 0);

  return {
    start,
    end,
    totalMinutes,
    areas: areas.map((area) => {
      const areaLogs = weekLogs.filter((l) => l.area_id === area.id);
      const sessions = areaLogs.length;
      const minutes = areaLogs.reduce((sum, l) => sum + l.duration_min, 0);
      const progress = area.floor_type === 'sessions' ? sessions : minutes;
      const energies = areaLogs.map((l) => l.energy).filter((e): e is number => e != null);
      return {
        area,
        sessions,
        minutes,
        progress,
        floorRatio: area.floor_value > 0 ? Math.min(1, progress / area.floor_value) : 1,
        floorMet: progress >= area.floor_value,
        share: totalMinutes > 0 ? minutes / totalMinutes : 0,
        avgEnergy: energies.length ? energies.reduce((a, b) => a + b, 0) / energies.length : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type Alert =
  | { kind: 'neglect'; area: Area; days: number }
  | { kind: 'dominance'; area: Area; share: number }
  | { kind: 'ceiling'; area: Area; minutes: number; ceiling: number };

/**
 * - neglect: no logs in the last NEGLECT_DAYS days (areas created within that
 *   window are skipped, so a brand-new area doesn't alert immediately).
 * - ceiling: over the area's own weekly ceiling, when it has one.
 * - dominance: more than DOMINANCE_SHARE of this week's logged minutes
 *   (only for areas without a ceiling, e.g. so a full work week doesn't alert).
 *
 * `logs` must cover at least statsWindowStart(now).
 */
export function computeAlerts(
  areas: Area[],
  logs: Log[],
  now: Date,
  timeZone: string = TIME_ZONE,
): Alert[] {
  const alerts: Alert[] = [];
  const cutoff = now.getTime() - NEGLECT_DAYS * DAY_MS;

  for (const area of areas) {
    if (new Date(area.created_at).getTime() > cutoff) continue;
    const recent = logs.some(
      (l) => l.area_id === area.id && new Date(l.logged_at).getTime() >= cutoff,
    );
    if (!recent) alerts.push({ kind: 'neglect', area, days: NEGLECT_DAYS });
  }

  const week = computeWeekStats(areas, logs, now, timeZone);
  for (const s of week.areas) {
    const ceiling = s.area.ceiling_min;
    if (ceiling != null) {
      if (s.minutes > ceiling) alerts.push({ kind: 'ceiling', area: s.area, minutes: s.minutes, ceiling });
    } else if (week.totalMinutes > 0 && s.share > DOMINANCE_SHARE) {
      alerts.push({ kind: 'dominance', area: s.area, share: s.share });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Time split (donut)
// ---------------------------------------------------------------------------

export interface TimeSlice {
  id: string;
  name: string;
  color: string | null;
  minutes: number;
  share: number;
}

/** Areas with time logged this week, largest first. Past `maxSlices`, the smallest fold into "Other". */
export function timeSlices(week: WeekStats, maxSlices = 6): TimeSlice[] {
  const slices = week.areas
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((s) => ({ id: s.area.id, name: s.area.name, color: s.area.color, minutes: s.minutes, share: s.share }));
  if (slices.length <= maxSlices) return slices;

  const rest = slices.slice(maxSlices - 1);
  const minutes = rest.reduce((sum, s) => sum + s.minutes, 0);
  return [
    ...slices.slice(0, maxSlices - 1),
    { id: 'other', name: `Other (${rest.length})`, color: null, minutes, share: minutes / week.totalMinutes },
  ];
}
