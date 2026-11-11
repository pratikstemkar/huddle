import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { formatRange, fromDay, toDay } from '@/lib/dates';
import { useTripLive } from '@/lib/realtime';
import { lockTrip, useTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day in `YYYY-MM-DD` form (rejects 2027-02-31). */
function validDay(s: string) {
  return ISO_DAY.test(s) && toDay(fromDay(s)) === s;
}

export default function LockTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { trip, loading, refresh } = useTrip(id, session?.user.id);

  // null until the organiser changes something, so we show the suggested defaults until then.
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useTripLive(id, refresh);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/trip/[id]', params: { id: id ?? '' } });
  };

  if (loading && !trip) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  const isOrganiser = !!trip && trip.members.some((m) => m.user_id === session?.user.id && m.role === 'organiser');
  if (!trip || !isOrganiser || trip.status === 'locked') {
    return (
      <Screen footer={<Button label="Close" onPress={close} />}>
        <Text variant="title">Lock in the plan</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          {!trip
            ? "This trip doesn't exist, or you're not a member of it."
            : trip.status === 'locked'
              ? 'This trip is already locked in.'
              : 'Only the organiser can lock the trip.'}
        </Text>
      </Screen>
    );
  }

  const fill = tripColors[trip.color] ?? tripColors.sunset;
  const best = trip.bestDays;
  const startDay = start ?? best[0]?.start ?? '';
  const endDay = end ?? best[0]?.end ?? '';
  const destId = destination ?? trip.destinations[0]?.id ?? null;

  const lock = async () => {
    if (!validDay(startDay) || !validDay(endDay)) {
      setError('Enter both dates as YYYY-MM-DD, for example 2027-03-14.');
      return;
    }
    if (startDay > endDay) {
      setError('The end date can’t be before the start date.');
      return;
    }
    if (!destId) {
      setError('Pick a destination first.');
      return;
    }
    setSaving(true);
    try {
      await lockTrip(trip.id, startDay, endDay, destId);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setError("Couldn't lock the trip. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const dateInput = (label: string, value: string, set: (v: string) => void) => (
    <View style={{ flex: 1, gap: space.xs }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => {
          set(t.trim());
          if (error) setError(null);
        }}
        accessibilityLabel={label}
        placeholder="2027-03-14"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={10}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]}
      />
    </View>
  );

  return (
    <Screen footer={<Button label="Lock in the plan" color={fill} loading={saving} onPress={lock} />}>
      <Text variant="title">Lock in the plan</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: space.xs }}>
        Everyone sees the final dates and place. Days and votes stop changing.
      </Text>

      <Text variant="label" style={styles.label}>
        Dates
      </Text>
      {best.length > 0 ? (
        <View style={styles.chips}>
          {best.map((r) => {
            const on = startDay === r.start && endDay === r.end;
            return (
              <Pressable
                key={r.start}
                accessibilityRole="radio"
                accessibilityLabel={`${formatRange(r.start, r.end)}, ${r.free} of ${trip.members.length} free`}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setStart(r.start);
                  setEnd(r.end);
                  setError(null);
                }}
                style={[styles.chip, { backgroundColor: on ? fill : colors.card, borderColor: on ? fill : colors.line }]}>
                <Text variant="label" tone={on ? 'onColor' : 'primary'}>
                  {formatRange(r.start, r.end)}
                </Text>
                <Text variant="caption" tone={on ? 'onColor' : 'muted'}>
                  {r.free} of {trip.members.length} free
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.dates}>
        {dateInput('Start date', startDay, setStart)}
        {dateInput('End date', endDay, setEnd)}
      </View>

      <Text variant="label" style={styles.label}>
        Destination
      </Text>
      {trip.destinations.length === 0 ? (
        <Card>
          <Text variant="body" tone="secondary">
            Suggest at least one place first, then come back to lock the trip.
          </Text>
        </Card>
      ) : (
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {trip.destinations.map((d) => {
            const on = d.id === destId;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="radio"
                accessibilityLabel={`${d.title}, ${d.voteCount} ${d.voteCount === 1 ? 'vote' : 'votes'}`}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setDestination(d.id);
                  setError(null);
                }}
                style={[styles.option, { backgroundColor: colors.card, borderColor: on ? fill : colors.line, borderWidth: on ? 2 : 1 }]}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {d.voteCount} {d.voteCount === 1 ? 'vote' : 'votes'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.md }}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: space.xl, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: MIN_TOUCH, justifyContent: 'center' },
  dates: { flexDirection: 'row', gap: space.md },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: MIN_TOUCH + 8 },
});
