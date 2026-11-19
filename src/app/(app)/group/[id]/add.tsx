import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PeoplePicker } from '@/components/groups/people-picker';
import { SheetHeader } from '@/components/trip/sheet-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { inviteToGroup, useGroup, useKnownPeople } from '@/lib/groups';
import { space } from '@/theme/tokens';

export default function AddToGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { group, refresh: refreshGroup } = useGroup(id, session?.user.id);
  const { people, loading, refresh: refreshPeople } = useKnownPeople();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshGroup();
    refreshPeople();
  }, [refreshGroup, refreshPeople]);

  // Members and people already invited can't be picked again.
  const disabled = new Map<string, string>();
  group?.members.forEach((m) => disabled.set(m.user_id, 'In the group'));
  group?.pending.forEach((p) => disabled.set(p.user_id, 'Invited'));

  const toggle = (uid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (!n.delete(uid)) n.add(uid);
      return n;
    });

  const send = async () => {
    setSaving(true);
    try {
      await inviteToGroup(id, [...selected]);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the invites.");
    } finally {
      setSaving(false);
    }
  };

  const n = selected.size;
  return (
    <Screen footer={<Button label={n === 0 ? 'Pick someone to invite' : `Invite ${n} ${n === 1 ? 'person' : 'people'}`} loading={saving} onPress={n === 0 ? undefined : send} />}>
      <View style={styles.body}>
        <SheetHeader title="Add people" onClose={() => router.back()} />
        <PeoplePicker people={people} selected={selected} onToggle={toggle} disabled={disabled} loading={loading} />
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: space.lg } });
