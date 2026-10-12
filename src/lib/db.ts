import type {
  Area,
  AreaUpdate,
  Log,
  LogUpdate,
  NewArea,
  NewLog,
  NewReminder,
  Reminder,
  ReminderUpdate,
} from '@/types/db';

import { supabase } from './supabase';

function unwrap<T>({ data, error }: { data: unknown; error: Error | null }): T {
  if (error) throw error;
  return data as T;
}

// Areas

export async function listAreas(): Promise<Area[]> {
  return unwrap<Area[]>(
    await supabase.from('areas').select('*').order('created_at', { ascending: true }),
  );
}

export async function createArea(input: NewArea): Promise<Area> {
  return unwrap<Area>(await supabase.from('areas').insert(input).select().single());
}

export async function updateArea(id: string, patch: AreaUpdate): Promise<Area> {
  return unwrap<Area>(await supabase.from('areas').update(patch).eq('id', id).select().single());
}

export async function deleteArea(id: string): Promise<void> {
  unwrap(await supabase.from('areas').delete().eq('id', id));
}

// Logs

export async function createLog(input: NewLog): Promise<Log> {
  return unwrap<Log>(await supabase.from('logs').insert(input).select().single());
}

export async function listLogsSince(since: Date): Promise<Log[]> {
  return unwrap<Log[]>(
    await supabase
      .from('logs')
      .select('*')
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false }),
  );
}

export async function updateLog(id: string, patch: LogUpdate): Promise<Log> {
  return unwrap<Log>(await supabase.from('logs').update(patch).eq('id', id).select().single());
}

export async function deleteLog(id: string): Promise<void> {
  unwrap(await supabase.from('logs').delete().eq('id', id));
}

// Reminders

export async function listOpenReminders(): Promise<Reminder[]> {
  return unwrap<Reminder[]>(
    await supabase.from('reminders').select('*').is('done_at', null).order('due_at', { ascending: true }),
  );
}

export async function createReminder(input: NewReminder): Promise<Reminder> {
  return unwrap<Reminder>(await supabase.from('reminders').insert(input).select().single());
}

export async function updateReminder(id: string, patch: ReminderUpdate): Promise<Reminder> {
  return unwrap<Reminder>(await supabase.from('reminders').update(patch).eq('id', id).select().single());
}

export async function deleteReminder(id: string): Promise<void> {
  unwrap(await supabase.from('reminders').delete().eq('id', id));
}

export async function completeReminder(id: string, logId: string | null): Promise<void> {
  unwrap(
    await supabase.from('reminders').update({ done_at: new Date().toISOString(), log_id: logId }).eq('id', id),
  );
}
