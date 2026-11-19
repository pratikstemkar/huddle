import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SheetHeader } from '@/components/trip/sheet-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useGroup, useGroups } from '@/lib/groups';
import { inviteToTrip, usePendingTripInvites } from '@/lib/trip-invites';
import { useTrip } from '@/lib/trips';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** "Who's invited?": pick one of my groups, leave people out for this trip only, invite the rest. */
export default function InvitePeople() {
  const { id, group: groupParam } = useLocalSearchParams<{ id: string; group?: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { groups, loading, refresh: refreshGroups } = useGroups(me);
  const { trip, refresh: refreshTrip } = useTrip(id, me);
  const { pending, refresh: refreshPending } = usePendingTripInvites(id);
  // The group chosen by tapping a chip; until then the one the link named, else my first.
  const [picked, setPicked] = useState<string | null>(null);
  const groupId = picked ?? (groups.some((g) => g.id === groupParam) ? (groupParam as string) : (groups[0]?.id ?? null));
  const { group, refresh: refreshGroup } = useGroup(groupId ?? undefined, me);
  // People left out for this trip only, per group.
  const [off, setOff] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshGroups();
      refreshTrip();
      refreshPending();
    }, [refreshGroups, refreshTrip, refreshPending]),
  );
  useFocusEffect(
    useCallback(() => {
      refreshGroup();
    }, [refreshGroup]),
  );

  const inTrip = new Set(trip?.members.map((m) => m.user_id));
  const invited = new Set(pending.map((p) => p.user_id));
  const others = group && group.id === groupId ? group.members.filter((m) => m.user_id !== me) : [];
  const left = new Set(off[groupId ?? ''] ?? []);
  const eligible = others.filter((m) => !inTrip.has(m.user_id) && !invited.has(m.user_id));
  const chosen = eligible.filter((m) => !left.has(m.user_id));
  const outCount = eligible.length - chosen.length;

  const setLeft = (ids: string[]) => groupId && setOff((o) => ({ ...o, [groupId]: ids }));
  const toggle = (uid: string) => setLeft(left.has(uid) ? [...left].filter((x) => x !== uid) : [...left, uid]);
  const allOn = outCount === 0;

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      await inviteToTrip(id, chosen.map((m) => m.user_id));
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the invites.");
    } finally {
      setSaving(false);
    }
  };

  const n = chosen.length;
  const cta = n === 0 ? 'Pick at least one person' : `Invite ${n} ${n === 1 ? 'person' : 'people'}`;

  return (
    <Screen footer={<Button label={cta} loading={saving} onPress={n === 0 ? undefined : send} />}>
      <View style={styles.body}>
        <SheetHeader title="Who’s invited?" onClose={() => router.back()} />

        {groups.length === 0 ? (
          <Text variant="callout" tone="secondary" accessibilityLiveRegion="polite">
            {loading ? 'Loading your groups' : 'You’re not in a group yet. Make one on the Groups tab, then invite it here.'}
          </Text>
        ) : (
          <>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {groups.map((g) => (
                <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => setPicked(g.id)} />
              ))}
            </View>

            <View style={styles.countRow}>
              <Text variant="calloutStrong">
                {n} of {eligible.length} from {group?.name ?? 'the group'}
              </Text>
              <Button
                label={allOn ? 'Clear' : 'Select all'}
                variant="ghost"
                size="sm"
                onPress={() => setLeft(allOn ? eligible.map((m) => m.user_id) : [])}
              />
            </View>

            <View style={styles.grid}>
              {others.map((m) => {
                const note = inTrip.has(m.user_id) ? 'In the trip' : invited.has(m.user_id) ? 'Invited' : null;
                const on = !note && !left.has(m.user_id);
                return (
                  <Pressable
                    key={m.user_id}
                    accessibilityRole="button"
                    accessibilityLabel={note ? `${m.display_name}, ${note}` : `${on ? 'Don’t invite' : 'Invite'} ${m.display_name}`}
                    accessibilityState={{ selected: on, disabled: !!note }}
                    disabled={!!note}
                    onPress={() => toggle(m.user_id)}
                    style={[styles.cell, note ? { opacity: 0.55 } : null]}>
                    <View style={[styles.ring, { borderColor: on ? colors.iris : 'transparent' }]}>
                      <Avatar name={m.display_name} url={m.avatar_url} color={m.avatar_color} size={52} />
                      {on ? (
                        <View style={[styles.tick, { backgroundColor: colors.iris, borderColor: colors.bg }]}>
                          <Icon name="check" size={12} color={colors.onIris} strokeWidth={3} />
                        </View>
                      ) : null}
                    </View>
                    <Text variant="caption" numberOfLines={1} style={styles.cellName}>
                      {m.display_name.split(' ')[0]}
                    </Text>
                    {note ? (
                      <Text variant="badge" tone="secondary">
                        {note}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {others.length > 0 && eligible.length === 0 ? (
              <Text variant="callout" tone="secondary">
                Everyone in {group?.name} is already in {trip?.name ?? 'the trip'} or invited.
              </Text>
            ) : null}

            {outCount > 0 ? (
              <SpeechCard>
                {outCount === 1 ? 'Leaving one person out for this trip only.' : `Leaving ${outCount} people out for this trip only.`} The group itself stays the same.
              </SpeechCard>
            ) : null}
          </>
        )}

        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '25%', alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  ring: { borderWidth: 2, borderRadius: 30, padding: 2 },
  tick: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cellName: { maxWidth: 76 },
});
