import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AreaForm } from '@/components/AreaForm';
import { Button } from '@/components/Button';
import { signOut } from '@/lib/auth';
import { createArea, deleteArea, listAreas, updateArea } from '@/lib/db';
import { errorMessage, formatMinutes } from '@/lib/format';
import { DEFAULT_AREA_COLOR } from '@/lib/palette';
import { useFocusLoad } from '@/lib/use-focus-load';
import type { Area, NewArea } from '@/types/db';

// null = closed, 'new' = create form, Area = edit form
type Editing = null | 'new' | Area;

export default function AreasScreen() {
  const { data: areas, error, reload, refresh, refreshing } = useFocusLoad(listAreas);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function open(next: Editing) {
    setFormError(null);
    setEditing(next);
  }

  async function submit(values: NewArea) {
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') await createArea(values);
      else if (editing) await updateArea(editing.id, values);
      setEditing(null);
      await reload();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(area: Area) {
    Alert.alert(`Delete ${area.name}?`, 'All logs for this area will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteArea(area.id);
            setEditing(null);
            await reload();
          } catch (e) {
            setFormError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView
        contentContainerClassName="gap-3 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#94a3b8" />}>
        {error && <Text className="text-rose-400">{error}</Text>}

        {areas?.map((area) => (
          <Pressable
            key={area.id}
            onPress={() => open(area)}
            className="flex-row items-center gap-3 rounded-2xl bg-slate-900 p-4 active:opacity-80">
            <View className="h-4 w-4 rounded-full" style={{ backgroundColor: area.color ?? DEFAULT_AREA_COLOR }} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-slate-100">{area.name}</Text>
              <Text className="text-sm text-slate-400">
                Floor: {area.floor_value} {area.floor_type === 'sessions' ? 'sessions' : 'min'} / week
                {area.ceiling_min != null && ` · Max ${formatMinutes(area.ceiling_min)}`}
              </Text>
            </View>
            <Text className="text-slate-500">Edit</Text>
          </Pressable>
        ))}

        <Button label="+ New area" variant="secondary" onPress={() => open('new')} />

        <View className="mt-8">
          <Button
            label="Sign out"
            variant="danger"
            onPress={() => signOut().catch((e) => Alert.alert('Sign out failed', errorMessage(e)))}
          />
        </View>
      </ScrollView>

      <Modal
        visible={editing != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}>
        {editing != null && (
          <AreaForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : editing}
            saving={saving}
            error={formError}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
            onDelete={editing === 'new' ? undefined : () => confirmDelete(editing)}
          />
        )}
      </Modal>
    </View>
  );
}
