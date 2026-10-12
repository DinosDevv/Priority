import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PALETTE } from '@/lib/palette';
import type { Area, FloorType, NewArea } from '@/types/db';

import { Button } from './Button';

interface Props {
  initial?: Area;
  saving: boolean;
  error: string | null;
  onSubmit: (values: NewArea) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const FLOOR_TYPES: { value: FloorType; label: string }[] = [
  { value: 'sessions', label: 'Sessions / week' },
  { value: 'minutes', label: 'Minutes / week' },
];

export function AreaForm({ initial, saving, error, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string>(initial?.color ?? PALETTE[0]);
  const [floorType, setFloorType] = useState<FloorType>(initial?.floor_type ?? 'sessions');
  const [floorValue, setFloorValue] = useState(initial ? String(initial.floor_value) : '');
  const [ceilingHours, setCeilingHours] = useState(
    initial?.ceiling_min != null ? String(initial.ceiling_min / 60) : '',
  );

  const value = parseInt(floorValue, 10);
  const ceiling = ceilingHours ? parseInt(ceilingHours, 10) : null;
  const valid = name.trim().length > 0 && value > 0 && (ceiling == null || ceiling > 0);

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerClassName="gap-6 p-5"
      keyboardShouldPersistTaps="handled">
      <Text className="text-2xl font-bold text-slate-100">{initial ? 'Edit area' : 'New area'}</Text>

      <View className="gap-2">
        <Text className="text-sm text-slate-400">Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Gym"
          placeholderTextColor="#64748b"
          className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm text-slate-400">Color</Text>
        <View className="flex-row flex-wrap gap-3">
          {PALETTE.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              className={`h-11 w-11 rounded-full border-2 ${color === c ? 'border-slate-100' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm text-slate-400">Weekly floor</Text>
        <View className="flex-row gap-2">
          {FLOOR_TYPES.map((t) => {
            const active = floorType === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setFloorType(t.value)}
                className={`h-12 flex-1 items-center justify-center rounded-xl ${active ? 'bg-slate-100' : 'bg-slate-800'}`}>
                <Text className={`font-semibold ${active ? 'text-slate-950' : 'text-slate-200'}`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={floorValue}
          onChangeText={(t) => setFloorValue(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder={floorType === 'sessions' ? 'e.g. 3' : 'e.g. 120'}
          placeholderTextColor="#64748b"
          maxLength={5}
          className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm text-slate-400">Weekly ceiling (hours, optional)</Text>
        <TextInput
          value={ceilingHours}
          onChangeText={(t) => setCeilingHours(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="e.g. 45"
          placeholderTextColor="#64748b"
          maxLength={3}
          className="h-12 rounded-xl bg-slate-800 px-4 text-base text-slate-100"
        />
        <Text className="text-xs text-slate-500">
          Alerts when this area goes over the ceiling. Without one, it alerts if the area takes more than half your week.
        </Text>
      </View>

      {error && <Text className="text-rose-400">{error}</Text>}

      <View className="gap-3">
        <Button
          label={initial ? 'Save changes' : 'Create area'}
          disabled={!valid}
          loading={saving}
          onPress={() =>
            onSubmit({
              name: name.trim(),
              color,
              floor_type: floorType,
              floor_value: value,
              ceiling_min: ceiling != null ? ceiling * 60 : null,
            })
          }
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
        {onDelete && <Button label="Delete area" variant="danger" onPress={onDelete} />}
      </View>
    </ScrollView>
  );
}
