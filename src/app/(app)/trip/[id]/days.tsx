import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DayCalendar, type CalendarMode, type CalendarPerson } from '@/components/day-calendar';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { bestRanges, useAvailability } from '@/lib/availability';
import { formatDay, formatRange, today as getToday, windowEnd } from '@/lib/dates';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { useTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors, type TripColor } from '@/theme/tokens';
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

  useTripLive(id, () => {
    refreshTrip();
    refreshAvailability();
  });

  const ranges = useMemo(() => bestRanges(av.counts, from), [av.counts, from]);

  const people = useMemo(() => {
    const out = new Map<string, CalendarPerson>();
    if (!trip) return out;
    // People who haven't picked a colour each get a different one, never the trip's own (the heatmap uses it),
    // so dots can be told apart.
    const spare = (Object.keys(tripColors) as TripColor[]).filter((c) => c !== trip.color);
    trip.members.forEach((m, i) => {
      out.set(m.user_id, {
        name: m.user_id === me ? 'You' : m.display_name,
        color: tripColors[m.avatar_color ?? spare[i % spare.length]],
      });
    });
    return out;
  }, [trip, me]);

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
  const showWho = trip.show_who_marked;
  const membersById = new Map(trip.members.map((m) => [m.user_id, m]));
  const freeOnSelected = selected && showWho ? (av.who.get(selected) ?? []) : [];
  const countOnSelected = selected ? (av.counts.get(selected) ?? 0) : 0;
  const selectedLabel = selected ? formatDay(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
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
          who={showWho ? av.who : undefined}
          people={showWho ? people : undefined}
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
          {selected ? (
            <Card style={{ gap: space.sm }}>
              <Text variant="label" tone="secondary" accessibilityLiveRegion="polite">
                {selectedLabel}: {countOnSelected === 0 ? 'nobody is free' : `${countOnSelected} of ${trip.members.length} free`}
              </Text>
              {freeOnSelected.length ? (
                <View style={styles.people}>
                  {freeOnSelected.map((u) => {
                    const m = membersById.get(u);
                    const name = u === me ? 'You' : (m?.display_name ?? 'Traveller');
                    return (
                      <View key={u} style={styles.person} accessible accessibilityLabel={name}>
                        <Avatar name={m?.display_name ?? name} url={m?.avatar_url} color={m?.avatar_color} fallbackColor={people.get(u)?.color ?? tripColors[trip.color]} size={28} />
                        <Text variant="body">{name}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : !showWho && countOnSelected > 0 ? (
                <Text variant="caption" tone="muted">
                  {av.myDays.has(selected) ? 'Including you. ' : ''}The organiser has hidden who marked which day.
                </Text>
              ) : null}
            </Card>
          ) : (
            <Text variant="caption" tone="secondary">
              {showWho
                ? 'Tap a day to see who is free. Dots show who marked it; your own days have an outline.'
                : 'Tap a day to see how many are free. Names are hidden for this trip; your own days have an outline.'}
            </Text>
          )}
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
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
