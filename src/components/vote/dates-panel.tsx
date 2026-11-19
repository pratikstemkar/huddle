import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayCalendar, type CalendarMode, type CalendarPerson } from '@/components/day-calendar';
import { useRegisterPipAction } from '@/components/nav/pip-action';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { bestRanges, useAvailability } from '@/lib/availability';
import { formatDay, formatRange, formatTripDates, today as getToday, windowEnd } from '@/lib/dates';
import { useTripLive } from '@/lib/realtime';
import type { TripDetail } from '@/lib/trips';
import { radius, space, toTripColor, tripColors, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { PanelLoading } from './panel-loading';

type Props = {
  trip: TripDetail;
  me: string | undefined;
  refreshTrip: () => void;
  /** The screen's kicker, title and segmented control, given this panel's kicker line. */
  header: (kicker: string) => ReactNode;
};

export function DatesPanel({ trip, me, refreshTrip, header }: Props) {
  const { colors } = useTheme();
  const av = useAvailability(trip.id, me);
  const refreshAvailability = av.refresh;
  const [mode, setMode] = useState<CalendarMode>('mine');
  const [selected, setSelected] = useState<string | null>(null);

  const from = useMemo(() => getToday(), []);
  const to = useMemo(() => windowEnd(from), [from]);

  useFocusEffect(
    useCallback(() => {
      refreshAvailability();
    }, [refreshAvailability]),
  );

  useTripLive(trip.id, () => {
    refreshTrip();
    refreshAvailability();
  });

  const locked = trip.status === 'locked';
  const fixed = !locked && !!(trip.fixed_start && trip.fixed_end);

  const markMine = useCallback(() => {
    setMode('mine');
    setSelected(null);
  }, []);
  useRegisterPipAction(locked || fixed ? null : 'Mark my days', locked || fixed ? null : markMine);

  const ranges = useMemo(() => bestRanges(av.counts, from), [av.counts, from]);

  const people = useMemo(() => {
    const out = new Map<string, CalendarPerson>();
    // People who haven't picked a colour each get a different one, never the trip's own (the heatmap uses it),
    // so dots can be told apart.
    const spare = (Object.keys(tripColors) as TripColor[]).filter((c) => c !== toTripColor(trip.color));
    trip.members.forEach((m, i) => {
      out.set(m.user_id, {
        name: m.user_id === me ? 'You' : m.display_name,
        color: tripColors[m.avatar_color ? toTripColor(m.avatar_color) : spare[i % spare.length]],
      });
    });
    return out;
  }, [trip.members, trip.color, me]);

  const memberCount = trip.members.length;
  // The marked headcount comes from the server; my own taps show straight away.
  const iMarkNow = av.myDays.size > 0;
  const marked = Math.max(0, trip.availabilityCount + (av.loading || iMarkNow === trip.iMarked ? 0 : iMarkNow ? 1 : -1));
  const kicker = `${trip.name} · ${marked} of ${memberCount} marked`;

  if (av.loading) {
    return (
      <>
        {header(kicker)}
        <PanelLoading label="Loading days" />
      </>
    );
  }

  if (fixed) {
    const organiser = trip.members.find((m) => m.role === 'organiser');
    const isOrganiser = organiser?.user_id === me;
    return (
      <>
        {header(kicker)}
        <Card style={styles.fixed}>
          <Text variant="label" tone="secondary">
            Dates are set
          </Text>
          <Text variant="titleSm">{formatTripDates(trip.fixed_start!, trip.fixed_end!)}</Text>
          {organiser ? (
            <Text variant="caption" tone="secondary">
              Set by {isOrganiser ? 'you' : organiser.display_name}
            </Text>
          ) : null}
          {isOrganiser ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Change in settings"
              onPress={() => router.push({ pathname: '/trip/[id]/settings', params: { id: trip.id } })}
              hitSlop={8}
              style={styles.link}>
              <Text variant="calloutStrong" tone="iris">
                Change in settings
              </Text>
            </Pressable>
          ) : null}
        </Card>
      </>
    );
  }

  const effectiveMode: CalendarMode = locked ? 'all' : mode;
  const showWho = trip.show_who_marked;
  const membersById = new Map(trip.members.map((m) => [m.user_id, m]));
  const freeOnSelected = selected && showWho ? (av.who.get(selected) ?? []) : [];
  const countOnSelected = selected ? (av.counts.get(selected) ?? 0) : 0;
  const selectedLabel = selected ? formatDay(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const best = ranges[0];

  return (
    <>
      {header(kicker)}

      {!locked ? (
        <Segmented
          size="sm"
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
      ) : null}

      <Text variant="caption" tone="secondary">
        {locked ? 'Locked in. Dates are set.' : 'Tap the days you could go.'}
      </Text>

      {av.error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {av.error}
        </Text>
      ) : null}

      <Card style={{ gap: space.sm }}>
        {ranges.length > 0 ? (
          <>
            <Text variant="label" tone="secondary">
              Best days
            </Text>
            {ranges.map((r, i) => (
              <View key={r.start} style={styles.bestRow}>
                <Text variant="bodyStrong" style={styles.shrink}>
                  {formatRange(r.start, r.end)}{' '}
                  <Text variant="body" tone="secondary">
                    · {r.free} of {memberCount} free
                  </Text>
                </Text>
                {i === 0 ? <Badge label="Leading" tone="beakSm" /> : null}
              </View>
            ))}
          </>
        ) : (
          <Text variant="body" tone="secondary">
            {av.counts.size === 0 ? 'Nobody has marked a day yet.' : 'No day suits two or more people yet.'}
          </Text>
        )}
      </Card>

      <Card>
        <DayCalendar
          from={from}
          to={to}
          today={from}
          mode={effectiveMode}
          myDays={av.myDays}
          counts={av.counts}
          memberCount={memberCount}
          selected={selected}
          readOnly={locked}
          onToggle={av.setDay}
          onSelect={(d) => setSelected((s) => (s === d ? null : d))}
          who={showWho ? av.who : undefined}
          people={showWho ? people : undefined}
        />
      </Card>

      {effectiveMode === 'all' ? (
        <View style={{ gap: space.sm }}>
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
                {selectedLabel}: {countOnSelected === 0 ? 'nobody is free' : `${countOnSelected} of ${memberCount} free`}
              </Text>
              {freeOnSelected.length ? (
                <View style={styles.people}>
                  {freeOnSelected.map((u) => {
                    const m = membersById.get(u);
                    const name = u === me ? 'You' : (m?.display_name ?? 'Traveller');
                    return (
                      <View key={u} style={styles.person} accessible accessibilityLabel={name}>
                        <Avatar
                          name={m?.display_name ?? name}
                          url={m?.avatar_url}
                          color={m?.avatar_color}
                          fallbackColor={people.get(u)?.color ?? tripColors[toTripColor(trip.color)]}
                          size={28}
                        />
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

      {!locked ? (
        <SpeechCard>
          {`${marked} of ${memberCount} have marked their days.${best ? ` Best so far: ${formatRange(best.start, best.end)}.` : ''}`}
        </SpeechCard>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fixed: { gap: space.s6 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 24, height: 16, borderRadius: radius.xs + 2 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
