import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { OptionCard } from '@/components/trip/option-card';
import { SheetHeader } from '@/components/trip/sheet-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { formatRange, fromDay, toDay } from '@/lib/dates';
import { useTripLive } from '@/lib/realtime';
import { lockTrip, useTrip } from '@/lib/trips';
import { space } from '@/theme/tokens';
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
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  const isOrganiser = !!trip && trip.members.some((m) => m.user_id === session?.user.id && m.role === 'organiser');
  if (!trip || !isOrganiser || trip.status === 'locked') {
    return (
      <Screen contentStyle={styles.content}>
        <SheetHeader title="Lock in the plan" onClose={close} />
        <Text variant="body" tone="secondary">
          {!trip
            ? "This trip doesn't exist, or you're not a member of it."
            : trip.status === 'locked'
              ? 'This trip is already locked in.'
              : 'Only the organiser can lock the trip.'}
        </Text>
      </Screen>
    );
  }

  const fixed = trip.fixed_start && trip.fixed_end ? { start: trip.fixed_start, end: trip.fixed_end } : null;
  const best = fixed ? [] : trip.bestDays;
  const startDay = start ?? fixed?.start ?? best[0]?.start ?? '';
  const endDay = end ?? fixed?.end ?? best[0]?.end ?? '';
  const destId = destination ?? trip.destinations[0]?.id ?? null;
  const topVotes = trip.destinations[0]?.voteCount ?? 0;
  const n = trip.members.length;

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
      router.replace({ pathname: '/trip/[id]/locked', params: { id: trip.id } });
    } catch {
      setError("Couldn't lock the trip. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const dateInput = (label: string, value: string, set: (v: string) => void) => (
    <Input
      label={label}
      value={value}
      onChangeText={(t) => {
        set(t.trim());
        if (error) setError(null);
      }}
      placeholder="2027-03-14"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={10}
      containerStyle={styles.flex}
    />
  );

  return (
    <Screen contentStyle={styles.content} footer={<Button label="Lock in the plan" loading={saving} onPress={lock} />}>
      <View style={{ gap: space.sm }}>
        <SheetHeader title="Lock in the plan" onClose={close} />
        <Text variant="callout" tone="secondary">
          Everyone sees the final dates and place. Days and votes stop changing.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="calloutStrong">When</Text>
        {best.length > 0 ? (
          <View accessibilityRole="radiogroup" style={styles.options}>
            {best.map((r) => (
              <OptionCard
                key={r.start}
                icon="plan"
                area="plan"
                title={formatRange(r.start, r.end)}
                sub={`${r.free} of ${n} free`}
                selected={startDay === r.start && endDay === r.end}
                onPress={() => {
                  setStart(r.start);
                  setEnd(r.end);
                  setError(null);
                }}
              />
            ))}
          </View>
        ) : null}
        <View style={styles.dates}>
          {dateInput('Start date', startDay, setStart)}
          {dateInput('End date', endDay, setEnd)}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="calloutStrong">Where</Text>
        {trip.destinations.length === 0 ? (
          <Card>
            <Text variant="callout" tone="secondary">
              Suggest at least one place first, then come back to lock the trip.
            </Text>
          </Card>
        ) : (
          <View accessibilityRole="radiogroup" style={styles.options}>
            {trip.destinations.map((d) => {
              const votes = `${d.voteCount} ${d.voteCount === 1 ? 'vote' : 'votes'}`;
              return (
                <OptionCard
                  key={d.id}
                  icon="vote"
                  area="vote"
                  title={d.title}
                  sub={votes}
                  selected={d.id === destId}
                  trailing={topVotes > 0 && d.voteCount === topVotes ? <Badge label="Leading" tone="beakSm" /> : undefined}
                  onPress={() => {
                    setDestination(d.id);
                    setError(null);
                  }}
                />
              );
            })}
          </View>
        )}
      </View>

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <SpeechCard>You can unlock it later in trip settings if plans change.</SpeechCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.s20 },
  section: { gap: space.s10 },
  options: { gap: space.s10 },
  dates: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
