import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useRegisterPipAction } from '@/components/nav/pip-action';
import { Pip } from '@/components/pip/pip';
import { countdownHeadline, friendsText } from '@/components/trip/countdown-text';
import { LockedSummary } from '@/components/trip/locked-summary';
import { forgetLockedSeen, hasSeenLocked, markLockedSeen } from '@/components/trip/locked-seen';
import { useShareOrCopy } from '@/components/trip/share';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { IconTile } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text, type Tone } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { nudgeSentText, nudgeTrip } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import { formatRange, formatTripDates, today } from '@/lib/dates';
import { useTripLive } from '@/lib/realtime';
import { useSplit } from '@/lib/split';
import { countdown, pipNext, tripDates, votedCount, type PipAction } from '@/lib/trip-status';
import { photosCardText, planCardText, splitCardText, useTripStats } from '@/lib/trip-stats';
import { planMessage, useTrip, type TripDetail } from '@/lib/trips';
import { radius, space, toTripColor, tripColors, tripTints, type TintArea } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { useTripId } from '@/components/nav/trip-id';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

type Tab = 'vote' | 'plan' | 'split' | 'photos';

function openTab(id: string, tab: Tab, seg?: 'places' | 'dates') {
  router.push({ pathname: `/trip/[id]/${tab}`, params: seg ? { id, seg } : { id } } as never);
}

function openSheet(id: string, sheet: 'invite' | 'lock' | 'suggest' | 'settings') {
  router.push({ pathname: `/trip/[id]/${sheet}`, params: { id } } as never);
}

function Header({ trip }: { trip: TripDetail }) {
  const { colors } = useTheme();
  const n = trip.members.length;
  return (
    <View style={styles.header}>
      <IconButton icon="back" accessibilityLabel="Back to your trips" onPress={goBack} />
      <View style={styles.headerRight}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${n} ${n === 1 ? 'person' : 'people'} in the huddle`}
          accessibilityHint="Opens the invite code and who's joined"
          onPress={() => openSheet(trip.id, 'invite')}
          hitSlop={6}>
          <AvatarStack
            people={trip.members.map((m) => ({ name: m.display_name, url: m.avatar_url, color: m.avatar_color }))}
            ring={colors.bg}
            max={4}
          />
        </Pressable>
        <IconButton icon="plus" variant="iris" accessibilityLabel="Invite people" onPress={() => openSheet(trip.id, 'invite')} style={styles.plus} />
      </View>
    </View>
  );
}

function Hero({ trip }: { trip: TripDetail }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const key = toTripColor(trip.color);
  const dates = tripDates(trip);
  const n = trip.members.length;

  let title: string;
  let sub: string;
  if (dates) {
    title = countdownHeadline(countdown(dates, today())) ?? formatRange(dates.start, dates.end);
    sub = `${formatRange(dates.start, dates.end)} · ${friendsText(n)}`;
  } else if (trip.bestDays.length > 0) {
    const best = trip.bestDays[0];
    title = formatRange(best.start, best.end);
    sub = `Best days so far · ${trip.availabilityCount} of ${n} marked`;
  } else {
    title = 'When can you go?';
    sub = trip.availabilityCount === 0 ? 'Nobody has marked their days yet' : `${trip.availabilityCount} of ${n} have marked their free days`;
  }

  const body = (
    <>
      <View style={styles.heroText}>
        <Text variant="calloutStrong" tone="onBeak" numberOfLines={1} style={styles.kicker}>
          {trip.name}
        </Text>
        <Text variant={title.length > 7 ? 'title' : 'display'} tone="onBeak" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="callout" tone="onBeak" numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <Pip size={104} shades wavePose scarf={tripColors[key]} style={styles.heroPip} />
    </>
  );

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
      {dates ? (
        <View style={[styles.hero, { backgroundColor: colors.beak }]} accessible accessibilityLabel={`${trip.name}. ${title}. ${sub}`}>
          {body}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${trip.name}. ${title}. ${sub}`}
          accessibilityHint="Opens the calendar to mark and compare free days"
          onPress={() => openTab(trip.id, 'vote', 'dates')}
          style={({ pressed }) => [styles.hero, { backgroundColor: tripTints[key] }, pressed && { opacity: 0.9 }]}>
          {body}
        </Pressable>
      )}
    </Animated.View>
  );
}

type TileProps = { title: string; sub: string; icon: IconName; area: TintArea; tone?: Tone; strong?: boolean; onPress: () => void };

function Tile({ title, sub, icon, area, tone = 'secondary', strong, onPress }: TileProps) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}, ${sub}`} style={styles.tile}>
      <IconTile area={area} icon={icon} />
      <View style={{ gap: space.xxs }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone={tone} style={strong ? styles.strong : undefined}>
          {sub}
        </Text>
      </View>
    </Card>
  );
}

function voteSub(trip: TripDetail) {
  if (trip.status === 'locked') {
    const place = trip.destinations.find((d) => d.id === trip.locked_destination_id);
    return place ? `${place.title} won` : 'Voting closed';
  }
  const leader = trip.destinations[0];
  if (!leader) return 'No places yet';
  const voted = votedCount(trip.destinations);
  if (voted === 0) return 'Nobody has voted yet';
  return `${leader.title} leads, ${voted} of ${trip.members.length} voted`;
}

export default function TripScreen() {
  const id = useTripId();
  const { session } = useAuth();
  const me = session?.user.id;
  const { trip, loading, error, refresh } = useTrip(id, me);
  const { stats, refresh: refreshStats } = useTripStats(id);
  const split = useSplit(id, me);
  const refreshSplit = split.refresh;
  const { colors } = useTheme();
  const { share } = useShareOrCopy();
  const toast = useToast();

  const reload = useCallback(() => {
    refresh();
    refreshStats();
    refreshSplit();
  }, [refresh, refreshStats, refreshSplit]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useTripLive(id, reload);

  // If the trip disappears while you're looking at it (the organiser deleted it), go back to your trips.
  const hadTrip = useRef(false);
  useEffect(() => {
    if (trip) hadTrip.current = true;
    else if (hadTrip.current && !loading && !error) router.replace('/');
  }, [trip, loading, error]);

  // Celebrate a lock once per trip on this device; an unlock resets it so the next lock celebrates again.
  const status = trip?.status;
  const tripId = trip?.id;
  useFocusEffect(
    useCallback(() => {
      if (!tripId || !status) return;
      let active = true;
      if (status === 'planning') {
        forgetLockedSeen(tripId);
        return;
      }
      hasSeenLocked(tripId).then((seen) => {
        if (!active || seen) return;
        markLockedSeen(tripId);
        router.push({ pathname: '/trip/[id]/locked', params: { id: tripId } });
      });
      return () => {
        active = false;
      };
    }, [tripId, status]),
  );

  const next = trip ? pipNext(trip, me, today(), { stats, transfers: split.transfers }) : null;

  const action = next?.action;
  const runPip = useCallback(() => {
    if (!trip || !action) return;
    const go: Record<PipAction, () => void> = {
      lock: () => openSheet(trip.id, 'lock'),
      days: () => openTab(trip.id, 'vote', 'dates'),
      suggest: () => openSheet(trip.id, 'suggest'),
      vote: () => openTab(trip.id, 'vote', 'places'),
      invite: () => openSheet(trip.id, 'invite'),
      share: () => {
        const place = trip.destinations.find((d) => d.id === trip.locked_destination_id)?.title ?? 'a place to be decided';
        const dates = trip.locked_start && trip.locked_end ? formatTripDates(trip.locked_start, trip.locked_end) : '';
        share(planMessage(trip.name, dates, place));
      },
      nudge: () => {
        nudgeTrip(trip.id, 'vote').then(
          (n) => toast.show(nudgeSentText(n)),
          (e: Error) => toast.show(e.message),
        );
      },
      plan: () => openTab(trip.id, 'plan'),
      split: () => openTab(trip.id, 'split'),
      photos: () => openTab(trip.id, 'photos'),
    };
    go[action]();
  }, [trip, action, share, toast]);
  useRegisterPipAction(next?.label ?? null, next ? runPip : null);

  if (loading && !trip) {
    return (
      <Screen withNav scroll={false} contentStyle={styles.center}>
        <Pip mood="hmm" size={96} />
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading trip" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen withNav footer={<Button label={error ? 'Try again' : 'Back to your trips'} onPress={error ? reload : goBack} />}>
        <View style={styles.header}>
          <IconButton icon="back" accessibilityLabel="Back to your trips" onPress={goBack} />
        </View>
        <View style={[styles.center, { gap: space.md }]}>
          <Pip mood="hmm" size={96} />
          <Text variant="title" style={styles.centerText}>
            {error ? 'Something went wrong' : 'Trip not found'}
          </Text>
          <Text variant="body" tone="secondary" style={styles.centerText}>
            {error ?? "This trip doesn't exist, or you're not a member of it."}
          </Text>
        </View>
      </Screen>
    );
  }

  const isLocked = trip.status === 'locked';
  const isOrganiser = trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const splitText = splitCardText(stats, trip.currency);

  return (
    <Screen withNav contentStyle={styles.content}>
      <Header trip={trip} />
      <Hero trip={trip} />

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {isLocked ? <LockedSummary trip={trip} /> : null}

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <Tile title="Vote" sub={voteSub(trip)} icon="vote" area="vote" onPress={() => openTab(trip.id, 'vote', 'places')} />
          <Tile title="Plan" sub={planCardText(trip, stats)} icon="plan" area="plan" onPress={() => openTab(trip.id, 'plan')} />
        </View>
        <View style={styles.gridRow}>
          <Tile
            title="Split"
            sub={splitText.text}
            icon="split"
            area="split"
            tone={splitText.tone === 'owed' ? 'positive' : splitText.tone === 'owe' ? 'owe' : 'secondary'}
            strong={splitText.tone !== 'muted'}
            onPress={() => openTab(trip.id, 'split')}
          />
          <Tile title="Photos" sub={photosCardText(stats?.photo_count ?? 0)} icon="photos" area="photos" onPress={() => openTab(trip.id, 'photos')} />
        </View>
      </View>

      {next ? (
        <SpeechCard
          action={
            <Button
              size="sm"
              label={next.label}
              accessibilityLabel={next.action === 'lock' ? 'Lock in the plan' : undefined}
              onPress={runPip}
            />
          }>
          {next.text}
        </SpeechCard>
      ) : null}

      <Card
        chevron
        onPress={() => openSheet(trip.id, 'settings')}
        accessibilityLabel="Trip settings"
        accessibilityHint={isOrganiser ? 'Rename, privacy, people' : 'Leave trip'}
        style={styles.settings}>
        <View style={styles.settingsText}>
          <Text variant="label">Trip settings</Text>
          <Text variant="caption" tone="secondary">
            {isOrganiser ? 'Rename, privacy, people' : 'Leave trip'}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { textAlign: 'center' },
  content: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  plus: { marginLeft: space.s6 },
  hero: {
    minHeight: 172,
    borderRadius: radius.xl,
    paddingVertical: space.s20,
    paddingHorizontal: space.s20,
    flexDirection: 'row',
    gap: space.sm,
    overflow: 'hidden',
  },
  heroText: { flex: 1, gap: space.xs },
  kicker: { fontSize: 13, lineHeight: 18 },
  heroPip: { alignSelf: 'flex-end', marginBottom: -34, flexShrink: 0 },
  grid: { gap: space.md },
  gridRow: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: space.s10 },
  strong: { fontWeight: '600' },
  settings: { minHeight: 56, borderRadius: radius.card, paddingVertical: space.s10 },
  settingsText: { flex: 1, gap: space.xxs },
});
