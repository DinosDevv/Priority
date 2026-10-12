import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { LogSheet } from '@/components/LogSheet';
import { deleteLog, listAreas, listLogsSince, listOpenReminders } from '@/lib/db';
import { errorMessage, formatLogTime, formatMinutes, formatProgress, formatTime } from '@/lib/format';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import { computeAlerts, computeWeekStats, dayKey, statsWindowStart } from '@/lib/stats';
import { useFocusLoad } from '@/lib/use-focus-load';
import type { Area, Log } from '@/types/db';

const DEFAULT_ENERGY = 3;
const RECENT_COUNT = 10;
const UNDO_MS = 5000;

async function loadLogScreen() {
  const now = new Date();
  const [areas, logs, reminders] = await Promise.all([
    listAreas(),
    listLogsSince(statsWindowStart(now)),
    listOpenReminders(),
  ]);
  const neglected = new Set(
    computeAlerts(areas, logs, now)
      .filter((a) => a.kind === 'neglect')
      .map((a) => a.area.id),
  );
  return {
    now,
    areas,
    tiles: computeWeekStats(areas, logs, now).areas.map((s) => ({ ...s, neglected: neglected.has(s.area.id) })),
    recent: logs.slice(0, RECENT_COUNT),
    lastEnergy: logs.find((l) => l.energy != null)?.energy ?? DEFAULT_ENERGY,
    today: reminders.filter((r) => dayKey(new Date(r.due_at)) === dayKey(now)),
  };
}

type Sheet = { area: Area; existing?: Log } | null;

export default function LogScreen() {
  const { data, error, reload, refresh, refreshing } = useFocusLoad(loadLogScreen);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saved, setSaved] = useState<{ log: Log; label: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [saved]);

  async function undo() {
    if (!saved) return;
    const { log } = saved;
    setSaved(null);
    try {
      await deleteLog(log.id);
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  const areaById = new Map(data?.areas.map((a) => [a.id, a]));

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView
        contentContainerClassName="gap-4 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#94a3b8" />}>
        {saved && (
          <View className="flex-row items-center gap-3 rounded-2xl bg-emerald-500/15 p-4">
            <Text className="flex-1 font-semibold text-emerald-300">{saved.label}</Text>
            <Pressable onPress={undo} hitSlop={12}>
              <Text className="font-semibold text-slate-100">Undo</Text>
            </Pressable>
          </View>
        )}

        {(error ?? actionError) && <Text className="text-rose-400">{error ?? actionError}</Text>}

        {data && data.today.length > 0 && (
          <Link href="/plan" asChild>
            <Pressable className="gap-1 rounded-2xl bg-slate-900 p-4 active:opacity-80">
              <Text className="text-sm text-slate-400">Today</Text>
              {data.today.map((r) => (
                <Text key={r.id} className="text-base text-slate-100" numberOfLines={1}>
                  <Text className="font-semibold">{formatTime(new Date(r.due_at))}</Text> {r.title}
                </Text>
              ))}
            </Pressable>
          </Link>
        )}

        {data && data.areas.length === 0 && (
          <View className="items-center gap-3 py-16">
            <Text className="text-lg text-slate-300">No areas yet.</Text>
            <Link href="/areas" className="text-base font-semibold text-sky-400">
              Create your first area →
            </Link>
          </View>
        )}

        <View className="flex-row flex-wrap justify-between gap-y-3">
          {data?.tiles.map(({ area, progress, floorMet, neglected }) => (
            <Pressable
              key={area.id}
              onPress={() => setSheet({ area })}
              className="h-32 w-[48.5%] justify-between rounded-3xl p-4 active:opacity-80"
              style={{ backgroundColor: area.color ?? DEFAULT_AREA_COLOR }}>
              <View className="flex-row justify-end">
                {(neglected || floorMet) && (
                  <View className="rounded-full bg-black/35 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-white">{neglected ? 'Neglected' : '✓ Floor met'}</Text>
                  </View>
                )}
              </View>
              <View>
                <Text className="text-xl font-bold text-white" numberOfLines={1}>
                  {area.name}
                </Text>
                <Text className="text-sm font-medium text-white/80">{formatProgress(area, progress)} this week</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {data && data.recent.length > 0 && (
          <View className="gap-2">
            <Text className="mt-2 text-sm text-slate-400">Recent logs</Text>
            {data.recent.map((log) => {
              const area = areaById.get(log.area_id);
              if (!area) return null;
              return (
                <Pressable
                  key={log.id}
                  onPress={() => setSheet({ area, existing: log })}
                  className="flex-row items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 active:opacity-80">
                  <View className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color ?? DEFAULT_AREA_COLOR }} />
                  <View className="flex-1">
                    <Text className="text-base text-slate-100" numberOfLines={1}>
                      {area.name} · {formatMinutes(log.duration_min)}
                    </Text>
                    <Text className="text-sm text-slate-400" numberOfLines={1}>
                      {formatLogTime(log.logged_at, data.now)}
                      {log.energy ? ` · energy ${log.energy}` : ''}
                      {log.note ? ` · ${log.note}` : ''}
                    </Text>
                  </View>
                  <Text className="text-slate-500">Edit</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {sheet && data && (
        <LogSheet
          area={sheet.area}
          existing={sheet.existing}
          initialEnergy={data.lastEnergy}
          onClose={() => setSheet(null)}
          onSaved={(log) => {
            if (!sheet.existing) {
              setSaved({ log, label: `Logged ${formatMinutes(log.duration_min)} · ${sheet.area.name}` });
            }
            setSheet(null);
            reload();
          }}
          onDeleted={() => {
            setSheet(null);
            reload();
          }}
        />
      )}
    </View>
  );
}
