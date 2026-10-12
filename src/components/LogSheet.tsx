import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createLog, deleteLog, updateLog } from '@/lib/db';
import { errorMessage } from '@/lib/format';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import type { Area, Log } from '@/types/db';

import { Button } from './Button';

const PRESETS = [15, 30, 60, 90];
const ENERGY = [1, 2, 3, 4, 5];
const WHEN = [
  { daysAgo: 0, label: 'Today' },
  { daysAgo: 1, label: 'Yesterday' },
  { daysAgo: 2, label: '2 days ago' },
];
const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  area: Area;
  /** When set, the sheet edits this log instead of creating one. */
  existing?: Log;
  /** Pre-selected duration for a new log (e.g. a reminder's planned minutes). */
  initialDuration?: number;
  initialEnergy: number;
  onClose: () => void;
  onSaved: (log: Log) => void;
  onDeleted?: () => void;
}

function chip(active: boolean) {
  return {
    box: `h-12 flex-1 items-center justify-center rounded-xl ${active ? 'bg-slate-100' : 'bg-slate-800'}`,
    text: `font-semibold ${active ? 'text-slate-950' : 'text-slate-200'}`,
  };
}

export function LogSheet({ area, existing, initialDuration, initialEnergy, onClose, onSaved, onDeleted }: Props) {
  const insets = useSafeAreaInsets();
  const startDuration = existing?.duration_min ?? initialDuration;
  const isPreset = startDuration != null && PRESETS.includes(startDuration);
  const [preset, setPreset] = useState<number | null>(startDuration != null && isPreset ? startDuration : null);
  // null = custom input hidden
  const [custom, setCustom] = useState<string | null>(
    startDuration != null && !isPreset ? String(startDuration) : null,
  );
  const [daysAgo, setDaysAgo] = useState(0);
  const [energy, setEnergy] = useState<number | null>(existing ? existing.energy : initialEnergy);
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customMin = custom != null ? parseInt(custom, 10) : NaN;
  const duration = custom != null ? (customMin > 0 ? customMin : null) : preset;
  const color = area.color ?? DEFAULT_AREA_COLOR;

  async function save() {
    if (!duration) return;
    setSaving(true);
    setError(null);
    try {
      const fields = { duration_min: duration, energy, note: note.trim() || null };
      const log = existing
        ? await updateLog(existing.id, fields)
        : await createLog({
            ...fields,
            area_id: area.id,
            logged_at: daysAgo > 0 ? new Date(Date.now() - daysAgo * DAY_MS).toISOString() : undefined,
          });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(log);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert('Delete this log?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteLog(existing.id);
            onDeleted?.();
          } catch (e) {
            setError(errorMessage(e));
            setSaving(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="gap-5 rounded-t-3xl bg-slate-900 px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}>
          <View className="h-1 w-10 self-center rounded-full bg-slate-700" />

          <View className="flex-row items-center gap-3">
            <View className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
            <Text className="flex-1 text-xl font-bold text-slate-100">{area.name}</Text>
            {existing && <Text className="text-sm text-slate-400">Edit log</Text>}
          </View>

          <View className="gap-2">
            <Text className="text-sm text-slate-400">Duration</Text>
            <View className="flex-row gap-2">
              {PRESETS.map((min) => {
                const c = chip(custom == null && preset === min);
                return (
                  <Pressable
                    key={min}
                    onPress={() => {
                      setCustom(null);
                      setPreset(min);
                    }}
                    className={c.box}>
                    <Text className={c.text}>{min}m</Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => setCustom(custom ?? '')} className={chip(custom != null).box}>
                <Text className={chip(custom != null).text}>Custom</Text>
              </Pressable>
            </View>
            {custom != null && (
              <TextInput
                value={custom}
                onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Minutes"
                placeholderTextColor="#64748b"
                autoFocus={startDuration == null}
                maxLength={4}
                className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
              />
            )}
          </View>

          {!existing && (
            <View className="gap-2">
              <Text className="text-sm text-slate-400">When</Text>
              <View className="flex-row gap-2">
                {WHEN.map((w) => {
                  const c = chip(daysAgo === w.daysAgo);
                  return (
                    <Pressable key={w.daysAgo} onPress={() => setDaysAgo(w.daysAgo)} className={c.box}>
                      <Text className={c.text}>{w.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View className="gap-2">
            <Text className="text-sm text-slate-400">Energy</Text>
            <View className="flex-row gap-2">
              {ENERGY.map((n) => {
                const c = chip(energy === n);
                return (
                  <Pressable key={n} onPress={() => setEnergy(n)} className={c.box}>
                    <Text className={c.text}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor="#64748b"
            className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
          />

          {error && <Text className="text-rose-400">{error}</Text>}

          <View className="gap-3">
            <Button label={existing ? 'Save changes' : 'Save'} onPress={save} disabled={!duration} loading={saving} />
            {existing && <Button label="Delete log" variant="danger" onPress={confirmDelete} disabled={saving} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
