export type FloorType = 'sessions' | 'minutes';

export interface Area {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  floor_type: FloorType;
  floor_value: number;
  /** Optional weekly maximum, in minutes. */
  ceiling_min: number | null;
  created_at: string;
}

export interface Log {
  id: string;
  user_id: string;
  area_id: string;
  duration_min: number;
  energy: number | null;
  note: string | null;
  logged_at: string;
}

/** user_id defaults to auth.uid() in the database. */
export type NewArea = Pick<Area, 'name' | 'color' | 'floor_type' | 'floor_value' | 'ceiling_min'>;
export type AreaUpdate = Partial<NewArea>;
/** logged_at defaults to now() in the database. */
export type NewLog = Pick<Log, 'area_id' | 'duration_min' | 'energy' | 'note'> & Partial<Pick<Log, 'logged_at'>>;
export type LogUpdate = Partial<Pick<Log, 'duration_min' | 'energy' | 'note'>>;

export interface Reminder {
  id: string;
  user_id: string;
  area_id: string | null;
  title: string;
  due_at: string;
  planned_min: number | null;
  /** Minutes before due_at to notify; null = no notification. */
  notify_before_min: number | null;
  done_at: string | null;
  log_id: string | null;
  created_at: string;
}

export type NewReminder = Pick<Reminder, 'area_id' | 'title' | 'due_at' | 'planned_min' | 'notify_before_min'>;
export type ReminderUpdate = Partial<NewReminder>;
