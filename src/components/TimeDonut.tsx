import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { formatMinutes } from '@/lib/format';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import type { TimeSlice } from '@/lib/stats';

const SIZE = 148;
const STROKE = 20;
const GAP = 2; // px of background between segments
const C = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function TimeDonut({ slices, totalMinutes }: { slices: TimeSlice[]; totalMinutes: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = slices.find((s) => s.id === selectedId) ?? null;
  const toggle = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

  const arcs = slices.map((slice, i) => {
    const start = slices.slice(0, i).reduce((sum, s) => sum + s.share, 0) * CIRC;
    const len = slice.share * CIRC;
    return { slice, start, len: slices.length > 1 ? Math.max(len - GAP, 1) : len };
  });

  return (
    <View className="gap-4 rounded-2xl bg-slate-900 p-4">
      <Text className="text-base font-semibold text-slate-100">Time split</Text>

      <View className="flex-row items-center gap-5">
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            <G rotation={-90} origin={`${C}, ${C}`}>
              <Circle cx={C} cy={C} r={R} stroke="#1e293b" strokeWidth={STROKE} fill="none" />
              {arcs.map(({ slice, start, len }) => (
                <Circle
                  key={slice.id}
                  cx={C}
                  cy={C}
                  r={R}
                  fill="none"
                  stroke={slice.color ?? DEFAULT_AREA_COLOR}
                  strokeWidth={STROKE}
                  strokeDasharray={`${len} ${CIRC}`}
                  strokeDashoffset={-start}
                  opacity={selected && selected.id !== slice.id ? 0.3 : 1}
                  onPress={() => toggle(slice.id)}
                />
              ))}
            </G>
          </Svg>
          <View className="pointer-events-none absolute inset-0 items-center justify-center px-6">
            <Text className="text-lg font-bold text-slate-100">
              {formatMinutes(selected?.minutes ?? totalMinutes)}
            </Text>
            <Text className="text-xs text-slate-400" numberOfLines={1}>
              {selected ? `${Math.round(selected.share * 100)}% · ${selected.name}` : 'this week'}
            </Text>
          </View>
        </View>

        <View className="flex-1 gap-2">
          {slices.map((slice) => (
            <Pressable
              key={slice.id}
              onPress={() => toggle(slice.id)}
              className={`flex-row items-center gap-2 ${selected && selected.id !== slice.id ? 'opacity-40' : ''}`}>
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color ?? DEFAULT_AREA_COLOR }} />
              <Text className="flex-1 text-sm text-slate-200" numberOfLines={1}>
                {slice.name}
              </Text>
              <Text className="text-sm text-slate-400">{Math.round(slice.share * 100)}%</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
