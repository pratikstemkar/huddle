import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SheetHeader } from '@/components/trip/sheet-header';
import { useShareOrCopy } from '@/components/trip/share';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useGroupsLive } from '@/lib/groups';
import { answeredIds, bestSlotId, lockHangout, slotLabel, slotShort, tally, useHangout } from '@/lib/hangouts';
import { appLink } from '@/lib/trips';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** "Lock the time": pick which of the offered times is the one. Organiser only. */
export default function LockHangout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { hangout, refresh } = useHangout(id);
  const { share, copied } = useShareOrCopy();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useGroupsLive(!!me, refresh);

  if (!hangout) {
    return (
      <Screen>
        <SheetHeader title="Lock the time" onClose={() => router.back()} />
      </Screen>
    );
  }

  if (hangout.created_by !== me || hangout.mode !== 'find' || hangout.status !== 'open') {
    return (
      <Screen>
        <View style={styles.body}>
          <SheetHeader title="Lock the time" onClose={() => router.back()} />
          <Text variant="callout" tone="secondary">
            {hangout.status === 'locked' ? 'This hangout is already locked.' : 'Only the organiser can lock the time.'}
          </Text>
        </View>
      </Screen>
    );
  }

  const total = hangout.members.length;
  const best = bestSlotId(hangout.slots);
  const chosenId = picked ?? best ?? hangout.slots[0]?.id ?? null;
  const chosen = hangout.slots.find((s) => s.id === chosenId) ?? null;
  const answered = answeredIds(hangout.slots);
  // The organiser doesn't need to answer their own hangout.
  const waiting = hangout.members.filter((m) => !answered.has(m.user_id) && m.user_id !== hangout.created_by);

  const lock = async () => {
    if (!chosen) return;
    setSaving(true);
    setError(null);
    try {
      await lockHangout(hangout.id, chosen.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't lock the time.");
    } finally {
      setSaving(false);
    }
  };

  const nudge = () => share(`${hangout.name}: which times work for you? ${appLink(`hangout/${hangout.id}`)}`);

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Text variant="caption" tone="secondary" style={styles.center}>
            Everyone sees the locked time and can add it to their calendar.
          </Text>
          {error ? (
            <Text variant="caption" tone="danger" style={styles.center} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label={chosen ? `Lock in ${slotShort(chosen.starts_at)}` : 'Pick a time'} icon="lock" loading={saving} onPress={chosen ? lock : undefined} />
        </View>
      }>
      <View style={styles.body}>
        <SheetHeader title={best ? 'Lock the time' : 'Pick the time'} onClose={() => router.back()} />
        <Text variant="callout" tone="secondary">
          {answered.size} of {total} answered{hangout.place_name ? ` · ${hangout.place_name}` : ''}
        </Text>

        <View accessibilityRole="radiogroup" style={styles.list}>
          {hangout.slots.map((slot) => {
            const t = tally(slot);
            const on = slot.id === chosenId;
            return (
              <Pressable
                key={slot.id}
                accessibilityRole="radio"
                accessibilityLabel={slotLabel(slot.starts_at, slot.ends_at)}
                accessibilityState={{ selected: on }}
                onPress={() => setPicked(slot.id)}
                style={[styles.option, { backgroundColor: colors.card, borderColor: on ? colors.iris : colors.line, borderWidth: on ? 2 : 1 }]}>
                <View style={styles.optionTop}>
                  <View style={[styles.dot, { borderColor: on ? colors.iris : colors.dashed, borderWidth: on ? 7 : 2 }]} />
                  <Text variant="label" style={styles.flex}>
                    {slotLabel(slot.starts_at, slot.ends_at)}
                  </Text>
                  {slot.id === best ? <Badge label="Most people" tone="beak" /> : null}
                </View>
                <View style={[styles.bar, { backgroundColor: colors.track }]}>
                  <View style={{ width: `${Math.round((t.yes / Math.max(total, 1)) * 100)}%`, backgroundColor: colors.positive }} />
                  <View style={{ width: `${Math.round((t.maybe / Math.max(total, 1)) * 100)}%`, backgroundColor: colors.beak }} />
                </View>
                <Text variant="caption" tone="secondary">
                  {t.yes} can · {t.maybe} if needed · {t.no} can’t
                </Text>
              </Pressable>
            );
          })}
        </View>

        {waiting.length > 0 ? (
          <View style={[styles.waiting, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Avatar name={waiting[0].display_name} url={waiting[0].avatar_url} color={waiting[0].avatar_color} size={32} />
            <Text variant="callout" style={styles.flex}>
              {waiting.length === 1 ? `${waiting[0].display_name} hasn’t answered yet` : `${waiting.length} people haven’t answered yet`}
            </Text>
            <Button label={copied ? 'Copied' : 'Nudge'} size="sm" variant="secondary" onPress={nudge} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  list: { gap: space.s10 },
  option: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: space.s10 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  waiting: { borderWidth: 1, borderRadius: radius.lg, padding: space.s10, flexDirection: 'row', alignItems: 'center', gap: space.md },
  footer: { gap: space.s10 },
  center: { textAlign: 'center' },
});
