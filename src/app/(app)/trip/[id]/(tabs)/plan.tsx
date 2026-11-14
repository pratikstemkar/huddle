import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useRegisterPipAction } from '@/components/nav/pip-action';
import { DayStrip } from '@/components/plan/day-strip';
import { PlanList } from '@/components/plan/plan-list';
import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { formatDay, today, type Day } from '@/lib/dates';
import { dayStyleFor, emptyDaysLine, groupByDay, itemsOffDates, planProgress, tripDays, usePlan, weekday, type PlanItem } from '@/lib/itinerary';
import { useTripLive } from '@/lib/realtime';
import { tripDates } from '@/lib/trip-status';
import { useTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const LIVE_TABLES = ['itinerary_items', 'trips', 'trip_members'] as const;

function Header({ line }: { line: string }) {
  return (
    <View style={styles.header}>
      <Text variant="callout" tone="secondary">
        {line}
      </Text>
      <Text variant="title">The plan</Text>
    </View>
  );
}

export default function PlanTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myId = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading, error, refresh: refreshTrip } = useTrip(id, myId);
  const plan = usePlan(id);
  const refreshPlan = plan.refresh;
  const [picked, setPicked] = useState<Day | null>(null);
  const [showOff, setShowOff] = useState(false);

  const refresh = useCallback(() => {
    refreshTrip();
    refreshPlan();
  }, [refreshTrip, refreshPlan]);
  useFocusEffect(refresh);
  useTripLive(id, refresh, [...LIVE_TABLES]);

  const dates = trip ? tripDates(trip) : null;
  const start = dates?.start;
  const end = dates?.end;
  const days = useMemo(() => (start && end ? tripDays(start, end) : []), [start, end]);
  const byDay = useMemo(() => groupByDay(plan.items), [plan.items]);
  const offDates = useMemo(() => itemsOffDates(plan.items, days), [plan.items, days]);

  const now = today();
  const fallback = days.includes(now) ? now : days[0];
  const selected = picked && days.includes(picked) ? picked : fallback;

  const addTo = useCallback(
    (day: Day | undefined) => {
      if (!id || !day) return;
      router.push({ pathname: '/trip/[id]/plan-item', params: { id, day } });
    },
    [id],
  );
  const addSelected = useCallback(() => addTo(selected), [addTo, selected]);
  const openVote = useCallback(() => {
    if (id) router.push({ pathname: '/trip/[id]/vote', params: { id, seg: 'dates' } });
  }, [id]);
  useRegisterPipAction(
    trip ? (selected ? `Add to ${weekday(selected)}` : 'Pick the dates in Vote') : null,
    trip ? (selected ? addSelected : openVote) : null,
  );

  if ((loading || plan.loading) && !trip) {
    return (
      <Screen withNav scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen withNav>
        <Header line="Plan" />
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          {error ?? "This trip doesn't exist, or you're not a member of it."}
        </Text>
      </Screen>
    );
  }

  if (!selected) {
    return (
      <Screen withNav contentStyle={styles.content}>
        <Header line={trip.name} />
        <Card style={styles.hmm}>
          <Pip mood="hmm" size={110} />
          <Text variant="body" tone="secondary" style={styles.centerText}>
            The plan opens once the dates are locked. Pick them in Vote.
          </Text>
          <Button label="Vote" size="md" onPress={openVote} accessibilityHint="Opens the dates vote" />
        </Card>
      </Screen>
    );
  }

  const isOrganiser = trip.members.some((m) => m.user_id === myId && m.role === 'organiser');
  const names = new Map(trip.members.map((m) => [m.user_id, m.display_name]));
  const addedBy = (i: PlanItem) => (i.created_by && i.created_by === myId ? 'you' : ((i.created_by && names.get(i.created_by)) || 'Someone'));
  const canEdit = (i: PlanItem) => isOrganiser || (!!myId && i.created_by === myId);
  const edit = (i: PlanItem) => router.push({ pathname: '/trip/[id]/plan-item', params: { id: trip.id, item: i.id } });

  const counts = new Map<Day, number>();
  for (const d of days) counts.set(d, byDay.get(d)?.length ?? 0);
  const progress = planProgress(
    days,
    days.filter((d) => (counts.get(d) ?? 0) > 0),
  );
  const items = byDay.get(selected) ?? [];
  const dayName = weekday(selected);
  const pipLine = emptyDaysLine(progress.empty, days, dayStyleFor(days)) + (progress.empty.length ? ' Dashed days have nothing planned yet.' : '');
  const offCount = offDates.length;

  return (
    <Screen withNav contentStyle={styles.content}>
      <Header line={`${trip.name} · ${progress.planned} of ${progress.total} days planned`} />
      <DayStrip days={days} selected={selected} counts={counts} onSelect={setPicked} />

      {offCount > 0 ? (
        <View style={{ gap: space.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${offCount} ${offCount === 1 ? "plan isn't" : "plans aren't"} on the new dates`}
            accessibilityState={{ expanded: showOff }}
            onPress={() => setShowOff((v) => !v)}
            style={({ pressed }) => [styles.offRow, { backgroundColor: colors.tint.plan }, pressed && { opacity: 0.8 }]}>
            <Text variant="calloutStrong" style={{ flex: 1 }}>
              {offCount} {offCount === 1 ? "plan isn't" : "plans aren't"} on the new dates
            </Text>
            <View style={{ transform: [{ rotate: showOff ? '90deg' : '0deg' }] }}>
              <Icon name="chevronRight" size={20} color={colors.textSecondary} />
            </View>
          </Pressable>
          {showOff ? (
            <PlanList
              items={offDates}
              addedBy={addedBy}
              canEdit={canEdit}
              onEdit={edit}
              prefix={(i) => formatDay(i.day, { weekday: 'short', day: 'numeric', month: 'short' })}
            />
          ) : null}
        </View>
      ) : null}

      {plan.error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {plan.error}
        </Text>
      ) : null}

      {items.length > 0 ? (
        <PlanList items={items} addedBy={addedBy} canEdit={canEdit} onEdit={edit} />
      ) : (
        <View style={[styles.empty, { borderColor: colors.dashed }]}>
          <Text variant="body" tone="secondary" style={styles.centerText}>
            Nothing planned for {dayName} yet.
          </Text>
        </View>
      )}

      <Button
        label={`Add to ${dayName}`}
        size="md"
        icon={<Icon name="plus" size={20} strokeWidth={2.4} color={colors.onIris} />}
        onPress={addSelected}
      />

      <SpeechCard>{pipLine}</SpeechCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.lg },
  header: { gap: space.xs },
  hmm: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl },
  centerText: { textAlign: 'center' },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.card, paddingVertical: space.xl, paddingHorizontal: space.lg },
  offRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TOUCH, borderRadius: radius.lg, paddingHorizontal: space.lg },
});
