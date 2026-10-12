import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { AlertCard } from '@/components/AlertCard';
import { ProgressBar } from '@/components/ProgressBar';
import { TimeDonut } from '@/components/TimeDonut';
import { listAreas, listLogsSince } from '@/lib/db';
import { formatDay, formatMinutes } from '@/lib/format';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import { computeAlerts, computeWeekStats, statsWindowStart, timeSlices, type AreaWeekStats } from '@/lib/stats';
import { useFocusLoad } from '@/lib/use-focus-load';

async function loadWeek() {
  const now = new Date();
  const [areas, logs] = await Promise.all([listAreas(), listLogsSince(statsWindowStart(now))]);
  const stats = computeWeekStats(areas, logs, now);
  return {
    stats,
    slices: timeSlices(stats),
    alerts: computeAlerts(areas, logs, now),
  };
}

export default function WeekScreen() {
  const { data, error, refresh, refreshing } = useFocusLoad(loadWeek);

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerClassName="gap-4 p-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#94a3b8" />}>
      {error && <Text className="text-rose-400">{error}</Text>}

      {data && (
        <>
          <View>
            <Text className="text-sm text-slate-400">
              {formatDay(data.stats.start)} – {formatDay(new Date(data.stats.end.getTime() - 1))}
            </Text>
            <Text className="text-2xl font-bold text-slate-100">
              {formatMinutes(data.stats.totalMinutes)} logged
            </Text>
          </View>

          {data.alerts.map((alert) => (
            <AlertCard key={`${alert.kind}-${alert.area.id}`} alert={alert} />
          ))}

          {data.stats.totalMinutes > 0 && (
            <TimeDonut slices={data.slices} totalMinutes={data.stats.totalMinutes} />
          )}

          {data.stats.areas.length === 0 && (
            <Text className="py-16 text-center text-slate-400">Create an area to see your week.</Text>
          )}

          {data.stats.areas.map((s) => (
            <AreaRow key={s.area.id} stats={s} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function AreaRow({ stats: s }: { stats: AreaWeekStats }) {
  const color = s.area.color ?? DEFAULT_AREA_COLOR;
  const unit = s.area.floor_type === 'sessions' ? 'sessions' : 'min';

  return (
    <View className="gap-3 rounded-2xl bg-slate-900 p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <Text className="flex-1 text-base font-semibold text-slate-100" numberOfLines={1}>
            {s.area.name}
          </Text>
        </View>
        <Text className={s.floorMet ? 'font-semibold text-emerald-400' : 'text-slate-300'}>
          {s.progress} / {s.area.floor_value} {unit}
        </Text>
      </View>

      <ProgressBar ratio={s.floorRatio} color={color} />

      <View className="flex-row justify-between">
        <Text className="text-sm text-slate-400">
          {Math.round(s.share * 100)}% of time
          {s.area.ceiling_min != null && ` · max ${formatMinutes(s.area.ceiling_min)}`}
        </Text>
        <Text className="text-sm text-slate-400">
          {s.avgEnergy != null ? `Avg energy ${s.avgEnergy.toFixed(1)}` : 'No energy data'}
        </Text>
      </View>
    </View>
  );
}
