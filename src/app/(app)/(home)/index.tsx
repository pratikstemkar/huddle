import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Pip } from '@/components/pip/pip';
import { Avatar } from '@/components/ui/avatar';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { nudgeSentText, nudgeTrip, useActivity } from '@/lib/activity';
import { displayName, useAuth } from '@/lib/auth';
import { formatRange, formatTripDates, today as todayDay, type Day } from '@/lib/dates';
import { useMyProfile } from '@/lib/profile';
import { countdown, homeChip, sortTrips, tripDates, type ChipTone } from '@/lib/trip-status';
import {
  leadingPlaceName,
  useTrips,
  type Trip,
  type TripCover,
  type TripSummary,
} from '@/lib/trips';
import { MIN_TOUCH, palette, radius, space, toTripColor, tripTints } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

const CHIP_TONES: Record<ChipTone, BadgeTone> = { action: 'beak', open: 'vote', done: 'neutral' };
// Only the first few cards cascade in; a long list never makes the last card wait.
const STAGGER_COUNT = 4;
const STAGGER_MS = 40;
// Trip tints are light in both schemes, so what sits on them is always ink.
const ON_TINT = palette.light.text;

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

type Hero =
  | { kind: 'nudge'; trip: Trip; text: string }
  | { kind: 'vote'; trip: Trip }
  | { kind: 'soon'; trip: Trip; text: string }
  | { kind: 'empty' }
  | { kind: 'idle' };

/** What Pip says at the top of Home: the first rule that matches any trip wins. */
function homeHero(trips: Trip[], summaries: Map<string, TripSummary>, today: Day): Hero {
  if (trips.length === 0) return { kind: 'empty' };
  for (const trip of trips) {
    const s = summaries.get(trip.id);
    if (trip.status !== 'planning' || !s || s.members < 2 || (trip.fixed_start && trip.fixed_end)) continue;
    const k = s.members - s.marked;
    if (k <= 0) continue;
    return { kind: 'nudge', trip, text: `${k} of ${s.members} still need to mark their days for ${trip.name}.` };
  }
  for (const trip of trips) {
    const s = summaries.get(trip.id);
    if (trip.status === 'planning' && s && s.places > 0 && !s.i_voted) return { kind: 'vote', trip };
  }
  for (const trip of trips) {
    const cd = countdown(tripDates(trip), today);
    if (cd?.kind === 'upcoming') return { kind: 'soon', trip, text: `${trip.name} is ${days(cd.days)} away. Start packing.` };
  }
  return { kind: 'idle' };
}

const openTrip = (id: string) => router.push({ pathname: '/trip/[id]', params: { id } });

function HeroCard({ hero }: { hero: Hero }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [nudging, setNudging] = useState(false);
  // Trips nudged from this screen: the server allows one nudge a day, so the button says so instead of offering another.
  const [nudged, setNudged] = useState<ReadonlySet<string>>(new Set());
  const [leading, setLeading] = useState<{ tripId: string; name: string | null } | null>(null);

  const voteTripId = hero.kind === 'vote' ? hero.trip.id : null;
  const leader = leading && leading.tripId === voteTripId ? leading.name : null;
  useEffect(() => {
    if (!voteTripId) return;
    let live = true;
    leadingPlaceName(voteTripId)
      .then((name) => {
        if (live) setLeading({ tripId: voteTripId, name });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [voteTripId]);

  // The server picks who still needs to mark their days, so nobody here learns who that is.
  const nudge = async (trip: Trip) => {
    setNudging(true);
    try {
      toast.show(nudgeSentText(await nudgeTrip(trip.id, 'days')));
      setNudged((prev) => new Set(prev).add(trip.id));
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setNudging(false);
    }
  };

  let text: string;
  let actions: ReactNode;
  switch (hero.kind) {
    case 'nudge':
      text = hero.text;
      actions = (
        <Button
          label={nudged.has(hero.trip.id) ? 'Nudged today' : 'Nudge them'}
          variant="beak"
          loading={nudging}
          disabled={nudged.has(hero.trip.id)}
          accessibilityHint="Sends a reminder to the people who haven't marked their days"
          onPress={() => nudge(hero.trip)}
        />
      );
      break;
    case 'vote':
      text = `Got a favourite for ${hero.trip.name}? ${leader ? `${leader} is ahead.` : 'Voting is open.'}`;
      actions = (
        <Button
          label="Vote"
          variant="beak"
          accessibilityHint={`Opens the vote for ${hero.trip.name}`}
          onPress={() => router.push({ pathname: '/trip/[id]/vote', params: { id: hero.trip.id, seg: 'places' } })}
        />
      );
      break;
    case 'soon':
      text = hero.text;
      actions = <Button label="Open" variant="beak" accessibilityHint={`Opens ${hero.trip.name}`} onPress={() => openTrip(hero.trip.id)} />;
      break;
    case 'empty':
      text = "No trips yet. Start one and I'll round up the gang.";
      actions = (
        <View style={styles.heroButtons}>
          <Button label="Start a trip" variant="beak" onPress={() => router.push('/new-trip')} />
          <Button label="Join with a code" variant="outline" size="sm" onPress={() => router.push('/join')} />
        </View>
      );
      break;
    case 'idle':
      text = "Got another trip in mind? I'll round up the gang.";
      actions = <Button label="Start a trip" variant="beak" onPress={() => router.push('/new-trip')} />;
      break;
  }

  return (
    <View style={[styles.hero, { backgroundColor: colors.iris }]}>
      <View style={styles.heroBody}>
        <Text accessibilityLiveRegion="polite" style={[styles.heroText, { color: colors.onIris }]}>
          {text}
        </Text>
        {actions}
      </View>
      <Pip mood={hero.kind === 'empty' ? 'snooze' : 'idle'} size={92} scarf={colors.beak} tail={colors.beak} wavePose={hero.kind !== 'empty'} />
    </View>
  );
}

function TripTile({ trip, cover, today }: { trip: Trip; cover?: TripCover; today: Day }) {
  const { colors } = useTheme();
  const cd = countdown(tripDates(trip), today);
  if (cd?.kind === 'upcoming' || cd?.kind === 'during') {
    const upcoming = cd.kind === 'upcoming';
    return (
      <View style={[styles.tile, { backgroundColor: colors.tint.trip }]}>
        <Text variant="number">{upcoming ? cd.days : 'Now'}</Text>
        <Text variant="tab" tone="secondary">
          {upcoming ? (cd.days === 1 ? 'day' : 'days') : 'on trip'}
        </Text>
      </View>
    );
  }
  if (cover) {
    return (
      <View style={styles.tile}>
        <Image source={{ uri: cover.url, cacheKey: cover.path ?? undefined }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  return (
    <View style={[styles.tile, { backgroundColor: tripTints[toTripColor(trip.color)] }]}>
      <Icon name={cd?.kind === 'past' ? 'photos' : 'mountain'} size={28} color={ON_TINT} />
    </View>
  );
}

function TripCard({
  trip,
  cover,
  summary,
  photoCount,
  today,
  index,
}: {
  trip: Trip;
  cover?: TripCover;
  summary?: TripSummary;
  photoCount: number;
  today: Day;
  index: number;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const dates = tripDates(trip);
  const chip = homeChip(trip, summary, photoCount, today);
  const people = summary ? (summary.members === 1 ? 'Just you' : `${summary.members} people`) : null;
  const sub = [dates ? formatRange(dates.start, dates.end) : 'Dates open', people].filter(Boolean).join(' · ');
  const label = `${trip.name}${chip ? `, ${chip.text}` : ''}${dates ? `, ${formatTripDates(dates.start, dates.end)}` : ''}`;
  return (
    <Animated.View
      entering={reduced || index >= STAGGER_COUNT ? undefined : FadeInDown.delay(index * STAGGER_MS).duration(260)}
      layout={reduced ? undefined : LinearTransition.springify()}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the trip"
        onPress={() => openTrip(trip.id)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.line, transform: [{ scale: pressed && !reduced ? 0.98 : 1 }] },
        ]}>
        <View aria-hidden>
          <TripTile trip={trip} cover={cover} today={today} />
        </View>
        <View style={styles.cardBody}>
          <Text variant="cardTitle" numberOfLines={2}>
            {trip.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {sub}
          </Text>
          {chip ? <Badge label={chip.text} tone={CHIP_TONES[chip.tone]} /> : null}
        </View>
        <Icon name="chevronRight" size={20} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

export default function Home() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const { trips, covers, summaries, photoCounts, loading, error, refresh } = useTrips();
  const { profile, refresh: refreshProfile } = useMyProfile(session?.user.id);
  const { unread } = useActivity(session?.user.id);
  const name = profile?.display_name ?? displayName(session);
  const today = todayDay();
  const hero = useMemo(() => homeHero(trips, summaries, today), [trips, summaries, today]);
  const sorted = useMemo(() => sortTrips(trips, today), [trips, today]);
  const firstLoad = loading && trips.length === 0;

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProfile();
    }, [refresh, refreshProfile]),
  );

  return (
    <Screen withNav>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="callout" tone="secondary">
              Hey {name.split(' ')[0]}
            </Text>
            <Text variant="title">Where to next?</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Activity, ${unread} unread` : 'Activity'}
            accessibilityHint="Invites, nudges and locked plans"
            onPress={() => router.push('/activity')}
            style={styles.avatar}>
            <Icon name="bell" size={24} color={colors.text} />
            {unread > 0 ? <View style={[styles.unread, { backgroundColor: colors.iris, borderColor: colors.bg }]} /> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            accessibilityHint="Edit your name and avatar, or sign out"
            onPress={() => router.push('/profile')}
            style={styles.avatar}>
            <Avatar name={name} url={profile?.avatar_url} color={profile?.avatar_color} fallbackColor={tripTints.blush} size={MIN_TOUCH} />
          </Pressable>
        </View>

        {firstLoad ? (
          <View style={styles.loading}>
            <Pip mood="hmm" size={96} />
            <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
              Loading your trips
            </Text>
          </View>
        ) : (
          <HeroCard hero={hero} />
        )}

        {!firstLoad ? (
          <View style={styles.list}>
            <Text variant="heading">Your trips</Text>
            {error ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {trips.length === 0 ? (
              <Card style={styles.empty}>
                <Text variant="cardTitle">Start your first trip</Text>
                <Text variant="callout" tone="secondary">
                  Give it a name, invite the group, and let everyone mark when they’re free.
                </Text>
              </Card>
            ) : null}
            {sorted.map((t, i) => (
              <TripCard
                key={t.id}
                trip={t}
                cover={covers.get(t.id)}
                summary={summaries.get(t.id)}
                photoCount={photoCounts.get(t.id) ?? 0}
                today={today}
                index={i}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: space.xxs },
  unread: { position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  avatar: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderRadius: radius.xl,
    paddingVertical: space.s18,
    paddingLeft: space.s20,
    paddingRight: space.s18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  heroBody: { flex: 1, gap: space.s10, alignItems: 'flex-start' },
  heroText: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  heroButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl },
  list: { gap: space.listGap },
  empty: { gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.s14, flexDirection: 'row', alignItems: 'center', gap: space.s14 },
  cardBody: { flex: 1, minWidth: 0, gap: space.xs },
  tile: { width: 64, height: 64, borderRadius: radius.tileLg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
