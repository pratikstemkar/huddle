import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { SheetHeader } from '@/components/trip/sheet-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';
import { MAX_GROUP_NAME, updateGroup, useGroup } from '@/lib/groups';
import { space, type TripColor } from '@/theme/tokens';

export default function EditGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { group, refresh } = useGroup(id, session?.user.id);
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<TripColor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    const trimmed = (name ?? group?.name ?? '').trim();
    if (!trimmed) {
      setError('Give your group a name first.');
      return;
    }
    setSaving(true);
    try {
      await updateGroup(id, { name: trimmed, color: color ?? group?.color });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the group.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button label="Save" loading={saving} onPress={save} />}>
      <View style={styles.body}>
        <SheetHeader title="Edit group" onClose={() => router.back()} />
        <Input
          label="Group name"
          value={name ?? group?.name ?? ''}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(null);
          }}
          error={error}
          maxLength={MAX_GROUP_NAME}
        />
        <ColorSwatches value={color ?? group?.color ?? null} onChange={setColor} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: space.lg } });
