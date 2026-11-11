import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DayCalendar, type CalendarMode } from '@/components/day-calendar';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { bestRanges, useAvailability } from '@/lib/availability';
import { formatDay, formatRange, today as getToday, windowEnd } from '@/lib/dates';
import { useAuth } from '@/lib/auth';
import { useTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function goBack(id: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/trip/[id]', params: { id } });
}

export default function DaysScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading: tripLoading, error: tripError, refresh: refreshTrip } = useTrip(id);
  const av = useAvailability(id, me);
  const refreshAvailability = av.refresh;
  const [mode, setMode] = useState<CalendarMode>('mine');
  const [selected, setSelected] = useState<string | null>(null);

  const from = useMemo(() => getToday(), []);
  const to = useMemo(() => windowEnd(from), [from]);

  useFocusEffect(
    useCallback(() => {
      refreshTrip();
      refreshAvailability();
    }, [refreshTrip, refreshAvailability]),
  );

  const ranges = useMemo(() => bestRanges(av.counts, from), [av.counts, from]);

  if ((tripLoading && !trip) || (av.loading && !tripError)) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading days" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <Text variant="title">{tripError ? 'Something went wrong' : 'Trip not found'}</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: space.sm }}>
          {tripError ?? "This trip doesn't exist, or you're not a member of it."}
        </Text>
      </Screen>
    );
  }

  const locked = trip.status === 'locked';
  const effectiveMode: CalendarMode = locked ? 'all' : mode;
  const names = new Map(trip.members.map((m) => [m.user_id, m.display_name]));
  const freeOnSelected = selected ? (av.who.get(selected) ?? []).map((u) => (u === me ? 'You' : (names.get(u) ?? 'Traveller'))) : [];
  const error = av.error ?? tripError;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the trip"
          onPress={() => goBack(trip.id)}
          hitSlop={8}
          style={[styles.back, { backgroundColor: colors.card }]}>
          <Text variant="title" style={{ lineHeight: 30 }}>
            ‹
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>
            {trip.name}
          </Text>
          <Text variant="caption" tone="muted">
            {locked ? 'Locked in. Dates are set.' : 'Tap the days you could go.'}
          </Text>
        </View>
      </View>

      {!locked ? (
        <View style={{ marginTop: space.lg }}>
          <Segmented
            options={[
              { value: 'mine', label: 'My days' },
              { value: 'all', label: 'Everyone' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setSelected(null);
            }}
          />
        </View>
      ) : null}

      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: space.md }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Card style={{ marginTop: space.lg, gap: space.xs }}>
        {ranges.length > 0 ? (
          <>
            <Text variant="label" tone="secondary">
              Best days
            </Text>
            {ranges.map((r) => (
              <Text key={r.start} variant="bodyStrong">
                {formatRange(r.start, r.end)} <Text tone="muted">· {r.free} of {trip.members.length} free</Text>
              </Text>
            ))}
          </>
        ) : (
          <Text variant="body" tone="secondary">
            {av.counts.size === 0 ? 'Nobody has marked a day yet.' : 'No day suits two or more people yet.'}
          </Text>
        )}
      </Card>

      <View style={{ marginTop: space.xl }}>
        <DayCalendar
          from={from}
          to={to}
          today={from}
          mode={effectiveMode}
          myDays={av.myDays}
          counts={av.counts}
          memberCount={trip.members.length}
          selected={selected}
          readOnly={locked}
          onToggle={av.setDay}
          onSelect={(d) => setSelected((s) => (s === d ? null : d))}
        />
      </View>

      {effectiveMode === 'all' ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <View style={styles.legend} accessible accessibilityLabel="Darker means more people are free">
            <Text variant="caption" tone="muted">
              Fewer free
            </Text>
            {colors.heat.map((c) => (
              <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
            ))}
            <Text variant="caption" tone="muted">
              More free
            </Text>
          </View>
          <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            {selected
              ? `${formatDay(selected, { weekday: 'long', day: 'numeric', month: 'long' })}: ${
                  freeOnSelected.length ? freeOnSelected.join(', ') : 'nobody is free'
                }`
              : 'Tap a day to see who is free. Your own days have an outline.'}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 24, height: 16, borderRadius: radius.sm / 2 },
});
