import { computeAlerts, computeWeekStats, statsWindowStart, timeSlices, weekBounds } from '../src/lib/stats';
import type { Area, Log } from '../src/types/db';

let seq = 0;

function area(overrides: Partial<Area> = {}): Area {
  return {
    id: `area-${++seq}`,
    user_id: 'u1',
    name: 'Area',
    color: '#22c55e',
    floor_type: 'sessions',
    floor_value: 3,
    ceiling_min: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function log(a: Area, logged_at: string, duration_min: number, energy: number | null = null): Log {
  return { id: `log-${++seq}`, user_id: 'u1', area_id: a.id, duration_min, energy, note: null, logged_at };
}

describe('weekBounds (Europe/Athens, Monday start)', () => {
  it('handles a summer Wednesday (UTC+3)', () => {
    const { start, end } = weekBounds(new Date('2026-07-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-12T21:00:00.000Z'); // Mon 13 Jul 00:00 local
    expect(end.toISOString()).toBe('2026-07-19T21:00:00.000Z');
  });

  it('handles a winter Wednesday (UTC+2)', () => {
    const { start } = weekBounds(new Date('2026-01-14T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-01-11T22:00:00.000Z'); // Mon 12 Jan 00:00 local
  });

  it('uses local time, not UTC, around Sunday midnight', () => {
    // Sun 23:30 local -> still the old week
    expect(weekBounds(new Date('2026-07-19T20:30:00Z')).start.toISOString()).toBe('2026-07-12T21:00:00.000Z');
    // Mon 00:30 local (still Sunday in UTC) -> new week
    expect(weekBounds(new Date('2026-07-19T21:30:00Z')).start.toISOString()).toBe('2026-07-19T21:00:00.000Z');
  });

  it('spans the DST change at the end of October', () => {
    const { start, end } = weekBounds(new Date('2026-10-22T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-18T21:00:00.000Z'); // UTC+3
    expect(end.toISOString()).toBe('2026-10-25T22:00:00.000Z'); // UTC+2
  });

  it('crosses a year boundary', () => {
    const { start } = weekBounds(new Date('2027-01-01T12:00:00Z')); // Friday
    expect(start.toISOString()).toBe('2026-12-27T22:00:00.000Z'); // Mon 28 Dec
  });
});

describe('statsWindowStart', () => {
  it('reaches back 5 days early in the week', () => {
    const now = new Date('2026-07-14T12:00:00Z'); // Tuesday
    expect(statsWindowStart(now).toISOString()).toBe('2026-07-09T12:00:00.000Z');
  });

  it('uses the week start late in the week', () => {
    const now = new Date('2026-07-19T12:00:00Z'); // Sunday
    expect(statsWindowStart(now).toISOString()).toBe('2026-07-12T21:00:00.000Z');
  });
});

describe('computeWeekStats', () => {
  const now = new Date('2026-07-15T12:00:00Z');

  it('computes floor progress, share and average energy', () => {
    const gym = area({ name: 'Gym', floor_type: 'sessions', floor_value: 3 });
    const study = area({ name: 'Study', floor_type: 'minutes', floor_value: 300 });
    const logs = [
      log(gym, '2026-07-13T08:00:00Z', 60, 4),
      log(gym, '2026-07-14T08:00:00Z', 30, null),
      log(study, '2026-07-14T10:00:00Z', 90, 2),
      log(gym, '2026-07-10T08:00:00Z', 60, 1), // previous week, ignored
    ];

    const stats = computeWeekStats([gym, study], logs, now);
    expect(stats.totalMinutes).toBe(180);

    const [g, s] = stats.areas;
    expect(g.sessions).toBe(2);
    expect(g.progress).toBe(2);
    expect(g.floorRatio).toBeCloseTo(2 / 3);
    expect(g.floorMet).toBe(false);
    expect(g.share).toBeCloseTo(0.5);
    expect(g.avgEnergy).toBe(4); // null energy is skipped

    expect(s.progress).toBe(90);
    expect(s.floorRatio).toBeCloseTo(0.3);
    expect(s.share).toBeCloseTo(0.5);
    expect(s.avgEnergy).toBe(2);
  });

  it('caps the floor ratio at 1 and handles an empty week', () => {
    const gym = area({ floor_type: 'sessions', floor_value: 1 });
    const [g] = computeWeekStats([gym], [log(gym, '2026-07-13T08:00:00Z', 30), log(gym, '2026-07-14T08:00:00Z', 30)], now).areas;
    expect(g.floorRatio).toBe(1);
    expect(g.floorMet).toBe(true);

    const empty = computeWeekStats([gym], [], now);
    expect(empty.totalMinutes).toBe(0);
    expect(empty.areas[0].share).toBe(0);
    expect(empty.areas[0].avgEnergy).toBeNull();
  });
});

describe('computeAlerts', () => {
  const now = new Date('2026-07-15T12:00:00Z');

  it('flags an area with no logs in the last 5 days', () => {
    const gym = area({ name: 'Gym' });
    const social = area({ name: 'Social' });
    const logs = [log(gym, '2026-07-14T08:00:00Z', 30), log(social, '2026-07-09T08:00:00Z', 30)];

    const neglect = computeAlerts([gym, social], logs, now).filter((a) => a.kind === 'neglect');
    expect(neglect.map((a) => a.area.name)).toEqual(['Social']);
  });

  it('does not flag an area created within the last 5 days', () => {
    const fresh = area({ created_at: '2026-07-13T00:00:00Z' });
    expect(computeAlerts([fresh], [], now)).toEqual([]);
  });

  it('flags an area with more than 50% of this week\'s time, but not exactly 50%', () => {
    const work = area({ name: 'Work' });
    const gym = area({ name: 'Gym' });

    const dominant = computeAlerts([work, gym], [log(work, '2026-07-14T08:00:00Z', 120), log(gym, '2026-07-14T18:00:00Z', 60)], now);
    expect(dominant.filter((a) => a.kind === 'dominance').map((a) => a.area.name)).toEqual(['Work']);

    const balanced = computeAlerts([work, gym], [log(work, '2026-07-14T08:00:00Z', 60), log(gym, '2026-07-14T18:00:00Z', 60)], now);
    expect(balanced.filter((a) => a.kind === 'dominance')).toEqual([]);
  });

  it('uses the ceiling instead of the 50% rule when an area has one', () => {
    const work = area({ name: 'Work', ceiling_min: 45 * 60 });
    const gym = area({ name: 'Gym' });
    const busy = (workMin: number) =>
      computeAlerts([work, gym], [log(work, '2026-07-14T08:00:00Z', workMin), log(gym, '2026-07-14T18:00:00Z', 60)], now)
        .filter((a) => a.kind !== 'neglect')
        .map((a) => [a.kind, a.area.name]);

    expect(busy(600)).toEqual([]); // 91% of the week, but under the 45h ceiling
    expect(busy(46 * 60)).toEqual([['ceiling', 'Work']]);
  });
});

describe('timeSlices', () => {
  const now = new Date('2026-07-15T12:00:00Z');

  it('drops areas without time and sorts largest first', () => {
    const a = area({ name: 'A' });
    const b = area({ name: 'B' });
    const idle = area({ name: 'Idle' });
    const week = computeWeekStats([a, b, idle], [log(a, '2026-07-14T08:00:00Z', 30), log(b, '2026-07-14T09:00:00Z', 90)], now);
    expect(timeSlices(week).map((s) => s.name)).toEqual(['B', 'A']);
  });

  it('folds the smallest areas into "Other" past the limit', () => {
    const areas = [1, 2, 3, 4].map((n) => area({ name: `A${n}` }));
    const logs = areas.map((a, i) => log(a, '2026-07-14T08:00:00Z', (4 - i) * 10)); // 40, 30, 20, 10
    const slices = timeSlices(computeWeekStats(areas, logs, now), 3);
    expect(slices.map((s) => s.name)).toEqual(['A1', 'A2', 'Other (2)']);
    expect(slices[2].minutes).toBe(30);
    expect(slices[2].share).toBeCloseTo(0.3);
  });
});
