import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createReminder, deleteReminder, updateReminder } from '@/lib/db';
import { errorMessage } from '@/lib/format';
import { ensurePermission } from '@/lib/notifications';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import type { Area, Reminder } from '@/types/db';

import { Button } from './Button';

const ALERTS: { label: string; value: number | null }[] = [
  { label: 'Off', value: null },
  { label: 'At time', value: 0 },
  { label: '15m', value: 15 },
  { label: '1h', value: 60 },
  { label: '1 day', value: 24 * 60 },
];
const DEFAULT_ALERT = 60;

interface Props {
  areas: Area[];
  existing?: Reminder;
  onClose: () => void;
  /** alertsOn is false when an alert was requested but notifications aren't allowed. */
  onSaved: (reminder: Reminder, alertsOn: boolean) => void;
  onDeleted?: () => void;
}

function chip(active: boolean) {
  return {
    box: `h-11 flex-1 items-center justify-center rounded-xl ${active ? 'bg-slate-100' : 'bg-slate-800'}`,
    text: `text-sm font-semibold ${active ? 'text-slate-950' : 'text-slate-200'}`,
  };
}

// Pickers work in the phone's local time.
function nextFullHour(now: Date): Date {
  const d = new Date(now);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function withDate(base: Date, day: Date): Date {
  const d = new Date(day);
  d.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return d;
}

function withTime(base: Date, time: Date): Date {
  const d = new Date(base);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

export function ReminderSheet({ areas, existing, onClose, onSaved, onDeleted }: Props) {
  const insets = useSafeAreaInsets();
  const [now] = useState(() => new Date());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [areaId, setAreaId] = useState<string | null>(existing?.area_id ?? null);
  const [due, setDue] = useState(() => (existing ? new Date(existing.due_at) : nextFullHour(now)));
  const [planned, setPlanned] = useState(existing?.planned_min != null ? String(existing.planned_min) : '');
  const [alert, setAlert] = useState<number | null>(existing ? existing.notify_before_min : DEFAULT_ALERT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plannedMin = parseInt(planned, 10);
  const valid = title.trim().length > 0;
  const isToday = due.toDateString() === now.toDateString();
  const isTomorrow = due.toDateString() === addDays(now, 1).toDateString();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const fields = {
        title: title.trim(),
        area_id: areaId,
        due_at: due.toISOString(),
        planned_min: areaId && plannedMin > 0 ? plannedMin : null,
        notify_before_min: alert,
      };
      const reminder = existing ? await updateReminder(existing.id, fields) : await createReminder(fields);
      const alertsOn = alert == null || (await ensurePermission());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(reminder, alertsOn);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert('Delete this reminder?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteReminder(existing.id);
            onDeleted?.();
          } catch (e) {
            setError(errorMessage(e));
            setSaving(false);
          }
        },
      },
    ]);
  }

  function openAndroidPicker(mode: 'date' | 'time') {
    DateTimePickerAndroid.open({
      value: due,
      mode,
      is24Hour: true,
      onValueChange: (_event, picked) => setDue(mode === 'date' ? withDate(due, picked) : withTime(due, picked)),
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View className="max-h-[92%] rounded-t-3xl bg-slate-900">
          <ScrollView
            contentContainerClassName="gap-5 px-5 pt-3"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled">
            <View className="h-1 w-10 self-center rounded-full bg-slate-700" />
            <Text className="text-xl font-bold text-slate-100">{existing ? 'Edit reminder' : 'New reminder'}</Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Driving lesson"
              placeholderTextColor="#64748b"
              autoFocus={!existing}
              className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
            />

            <View className="gap-2">
              <Text className="text-sm text-slate-400">When</Text>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setDue(withDate(due, now))} className={chip(isToday).box}>
                  <Text className={chip(isToday).text}>Today</Text>
                </Pressable>
                <Pressable onPress={() => setDue(withDate(due, addDays(now, 1)))} className={chip(isTomorrow).box}>
                  <Text className={chip(isTomorrow).text}>Tomorrow</Text>
                </Pressable>
              </View>
              {Platform.OS === 'ios' ? (
                <View className="flex-row items-center gap-2">
                  <DateTimePicker
                    value={due}
                    mode="date"
                    display="compact"
                    themeVariant="dark"
                    onValueChange={(_event, picked) => setDue(withDate(due, picked))}
                  />
                  <DateTimePicker
                    value={due}
                    mode="time"
                    display="compact"
                    themeVariant="dark"
                    onValueChange={(_event, picked) => setDue(withTime(due, picked))}
                  />
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <Pressable onPress={() => openAndroidPicker('date')} className={chip(false).box}>
                    <Text className={chip(false).text}>
                      {due.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => openAndroidPicker('time')} className={chip(false).box}>
                    <Text className={chip(false).text}>
                      {due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View className="gap-2">
              <Text className="text-sm text-slate-400">Area (optional)</Text>
              <View className="flex-row flex-wrap gap-2">
                {[null, ...areas].map((a) => {
                  const active = areaId === (a?.id ?? null);
                  return (
                    <Pressable
                      key={a?.id ?? 'none'}
                      onPress={() => setAreaId(a?.id ?? null)}
                      className={`h-10 flex-row items-center gap-2 rounded-full px-4 ${active ? 'bg-slate-100' : 'bg-slate-800'}`}>
                      {a && <View className="h-3 w-3 rounded-full" style={{ backgroundColor: a.color ?? DEFAULT_AREA_COLOR }} />}
                      <Text className={`text-sm font-semibold ${active ? 'text-slate-950' : 'text-slate-200'}`}>
                        {a?.name ?? 'None'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {areaId && (
                <TextInput
                  value={planned}
                  onChangeText={(t) => setPlanned(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="Planned minutes (optional, pre-fills the log)"
                  placeholderTextColor="#64748b"
                  maxLength={4}
                  className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
                />
              )}
            </View>

            <View className="gap-2">
              <Text className="text-sm text-slate-400">Alert</Text>
              <View className="flex-row gap-2">
                {ALERTS.map((a) => {
                  const c = chip(alert === a.value);
                  return (
                    <Pressable key={a.label} onPress={() => setAlert(a.value)} className={c.box}>
                      <Text className={c.text}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error && <Text className="text-rose-400">{error}</Text>}

            <View className="gap-3">
              <Button label={existing ? 'Save changes' : 'Save'} onPress={save} disabled={!valid} loading={saving} />
              {existing && <Button label="Delete reminder" variant="danger" onPress={confirmDelete} disabled={saving} />}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
