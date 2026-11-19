import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { PeoplePicker } from '@/components/groups/people-picker';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { createGroup, MAX_GROUP_NAME, useKnownPeople } from '@/lib/groups';
import { space, type TripColor } from '@/theme/tokens';

export default function NewGroup() {
  const { people, loading, error: peopleError, refresh } = useKnownPeople();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TripColor>('iris');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your group a name first.');
      return;
    }
    setSaving(true);
    try {
      const id = await createGroup(trimmed, color, [...selected]);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the group.");
    } finally {
      setSaving(false);
    }
  };

  const n = selected.size;
  return (
    <Screen footer={<Button label={n === 0 ? 'Create group' : `Create group · invite ${n}`} loading={saving} onPress={create} />}>
      <View style={styles.body}>
        <View style={styles.top}>
          <IconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
          <Text variant="calloutStrong" tone="secondary">
            New group
          </Text>
          <View style={styles.spacer} />
        </View>

        <Text variant="title">Who’s in this crew?</Text>

        <Input
          label="Group name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(null);
          }}
          error={error}
          placeholder="e.g. College gang"
          maxLength={MAX_GROUP_NAME}
          returnKeyType="done"
        />

        <View style={styles.group}>
          <Text variant="calloutStrong">Pick a colour</Text>
          <ColorSwatches value={color} onChange={setColor} />
        </View>

        <PeoplePicker people={people} selected={selected} onToggle={toggle} loading={loading} />
        {peopleError ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {peopleError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 44 },
  group: { gap: space.s10 },
});
