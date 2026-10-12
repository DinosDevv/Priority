import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LogSheet } from '@/components/LogSheet';
import { ReminderSheet } from '@/components/ReminderSheet';
import { completeReminder, listAreas, listOpenReminders } from '@/lib/db';
import { errorMessage, formatDay, formatMinutes, formatTime } from '@/lib/format';
import { syncReminderNotifications } from '@/lib/notifications';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import { groupReminders, type ReminderSection } from '@/lib/reminders';
import { useFocusLoad } from '@/lib/use-focus-load';
import type { Area, Reminder } from '@/types/db';

const DEFAULT_ENERGY = 3;

async function loadPlan() {
  const [areas, reminders] = await Promise.all([listAreas(), listOpenReminders()]);
  syncReminderNotifications(reminders).catch(() => {});
  return { now: new Date(), areas, reminders };
}

const SECTION_TITLES = { overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow' };

function sectionTitle(s: ReminderSection): string {
  return s.kind === 'day' ? formatDay(s.date) : SECTION_TITLES[s.kind];
}

type Sheet = { kind: 'reminder'; existing?: Reminder } | { kind: 'log'; reminder: Reminder; area: Area } | null;

export default function PlanScreen() {
  const { data, error, reload, refresh, refreshing } = useFocusLoad(loadPlan);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [alertsOff, setAlertsOff] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const areaById = new Map(data?.areas.map((a) => [a.id, a]));
  const sections = data ? groupReminders(data.reminders, data.now) : [];

  async function done(reminder: Reminder) {
    const area = reminder.area_id ? areaById.get(reminder.area_id) : undefined;
    if (area) {
      setSheet({ kind: 'log', reminder, area });
      return;
    }
    try {
      await completeReminder(reminder.id, null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView
        contentContainerClassName="gap-4 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#94a3b8" />}>
        {alertsOff && (
          <View className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <Text className="font-semibold text-amber-300">Alerts are off</Text>
            <Text className="mt-1 text-slate-300">
              Reminders are saved, but your phone won&apos;t notify you. Allow notifications for this app in Settings.
            </Text>
          </View>
        )}

        {(error ?? actionError) && <Text className="text-rose-400">{error ?? actionError}</Text>}

        <Button label="+ Add reminder" variant="secondary" onPress={() => setSheet({ kind: 'reminder' })} />

        {data && sections.length === 0 && (
          <Text className="py-12 text-center text-slate-400">
            Nothing planned. Add what&apos;s coming up so you can plan your day around it.
          </Text>
        )}

        {sections.map((section) => (
          <View key={section.key} className="gap-2">
            <Text
              className={`mt-2 text-sm font-semibold uppercase ${
                section.kind === 'overdue' ? 'text-rose-400' : 'text-slate-400'
              }`}>
              {sectionTitle(section)}
            </Text>
            {section.items.map((r) => {
              const due = new Date(r.due_at);
              const area = r.area_id ? areaById.get(r.area_id) : undefined;
              const details = [
                section.kind === 'overdue' ? formatDay(due) : null,
                area?.name,
                r.planned_min ? formatMinutes(r.planned_min) : null,
              ].filter(Boolean);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSheet({ kind: 'reminder', existing: r })}
                  className="flex-row items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 active:opacity-80">
                  <Text className="w-12 text-base font-semibold text-slate-200">{formatTime(due)}</Text>
                  <View className="flex-1">
                    <Text className="text-base text-slate-100" numberOfLines={1}>
                      {r.title}
                    </Text>
                    {details.length > 0 && (
                      <View className="flex-row items-center gap-1.5">
                        {area && (
                          <View
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: area.color ?? DEFAULT_AREA_COLOR }}
                          />
                        )}
                        <Text className="flex-1 text-sm text-slate-400" numberOfLines={1}>
                          {details.join(' · ')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {r.notify_before_min != null && <Ionicons name="notifications-outline" size={16} color="#94a3b8" />}
                  <Pressable onPress={() => done(r)} hitSlop={8} className="rounded-full bg-slate-800 px-3 py-1.5">
                    <Text className="text-sm font-semibold text-emerald-300">Done</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {sheet?.kind === 'reminder' && data && (
        <ReminderSheet
          areas={data.areas}
          existing={sheet.existing}
          onClose={() => setSheet(null)}
          onSaved={(_reminder, alertsOn) => {
            setAlertsOff(!alertsOn);
            setSheet(null);
            reload();
          }}
          onDeleted={() => {
            setSheet(null);
            reload();
          }}
        />
      )}

      {sheet?.kind === 'log' && (
        <LogSheet
          area={sheet.area}
          initialDuration={sheet.reminder.planned_min ?? undefined}
          initialEnergy={DEFAULT_ENERGY}
          onClose={() => setSheet(null)}
          onSaved={async (log) => {
            const { reminder } = sheet;
            setSheet(null);
            try {
              await completeReminder(reminder.id, log.id);
            } catch (e) {
              setActionError(errorMessage(e));
            }
            reload();
          }}
        />
      )}
    </View>
  );
}
