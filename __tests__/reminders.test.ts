import { groupReminders, notificationSchedule } from '../src/lib/reminders';
import type { Reminder } from '../src/types/db';

let seq = 0;

function reminder(due_at: string, overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: `r-${++seq}`,
    user_id: 'u1',
    area_id: null,
    title: 'Thing',
    due_at,
    planned_min: null,
    notify_before_min: null,
    done_at: null,
    log_id: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupReminders (Europe/Athens)', () => {
  const now = new Date('2026-07-15T09:00:00Z'); // Wed 12:00 local

  it('splits into overdue, today, tomorrow and later days, in order', () => {
    const sections = groupReminders(
      [
        reminder('2026-07-17T07:00:00Z', { title: 'Fri' }),
        reminder('2026-07-15T06:00:00Z', { title: 'Missed' }), // today 09:00, already passed
        reminder('2026-07-15T15:00:00Z', { title: 'Later today' }),
        reminder('2026-07-16T07:00:00Z', { title: 'Driving lesson' }),
      ],
      now,
    );
    expect(sections.map((s) => [s.kind, s.items.map((r) => r.title)])).toEqual([
      ['overdue', ['Missed']],
      ['today', ['Later today']],
      ['tomorrow', ['Driving lesson']],
      ['day', ['Fri']],
    ]);
  });

  it('uses Athens midnight, not UTC', () => {
    // 22:30 UTC on the 15th is 01:30 on the 16th in Athens
    expect(groupReminders([reminder('2026-07-15T22:30:00Z')], now)[0].kind).toBe('tomorrow');
  });

  it('leaves out done reminders', () => {
    expect(groupReminders([reminder('2026-07-16T07:00:00Z', { done_at: '2026-07-15T08:00:00Z' })], now)).toEqual([]);
  });
});

describe('notificationSchedule', () => {
  const now = new Date('2026-07-15T09:00:00Z');

  it('fires notify_before_min before due and skips done, alert-off and already-passed ones', () => {
    const lesson = reminder('2026-07-16T07:00:00Z', { title: 'Driving lesson', notify_before_min: 60 });
    const schedule = notificationSchedule(
      [
        lesson,
        reminder('2026-07-16T07:00:00Z', { notify_before_min: null }),
        reminder('2026-07-16T07:00:00Z', { notify_before_min: 0, done_at: '2026-07-15T08:00:00Z' }),
        reminder('2026-07-15T09:30:00Z', { notify_before_min: 60 }), // would have fired at 08:30Z
      ],
      now,
    );
    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({ id: lesson.id, title: 'Driving lesson', body: 'In 1h · 10:00' });
    expect(schedule[0].fireAt.toISOString()).toBe('2026-07-16T06:00:00.000Z');
  });
});
