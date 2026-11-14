import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PlacePhoto } from '@/components/place-photo';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { formatRange, formatTripDates, nightsBetween } from '@/lib/dates';
import { hostOf } from '@/lib/destinations';
import { inviteMessage, planMessage, useTrip, type TripDetail, type TripMember } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function BackButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to your trips"
      onPress={goBack}
      hitSlop={8}
      style={[styles.back, { backgroundColor: colors.card }]}>
      <Text variant="title" style={{ lineHeight: 30 }}>
        ‹
      </Text>
    </Pressable>
  );
}

function SettingsButton({ tripId }: { tripId: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Trip settings"
      onPress={() => router.push({ pathname: '/trip/[id]/settings', params: { id: tripId } })}
      hitSlop={8}
      style={[styles.back, { backgroundColor: colors.card }]}>
      <Text variant="title" style={{ lineHeight: 30 }}>
        ⋯
      </Text>
    </Pressable>
  );
}

function InviteCard({ trip }: { trip: TripDetail }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(trip.invite_code);
      setCopied(true);
    } catch {}
  };

  const share = async () => {
    const message = inviteMessage(trip.name, trip.invite_code);
    // Browsers without the Web Share API can't open a share sheet; copy the message instead.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      try {
        await Clipboard.setStringAsync(message);
        setCopied(true);
      } catch {}
      return;
    }
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.invite}>
        <Text variant="heading" selectable accessibilityLabel={`Invite code ${trip.invite_code.split('').join(' ')}`} style={{ letterSpacing: 2 }}>
          {trip.invite_code}
        </Text>
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {copied ? 'Copied!' : 'Friends join with this code'}
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <View style={{ flex: 1 }}>
          <Button label="Copy code" variant="secondary" onPress={copy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Share invite" onPress={share} />
        </View>
      </View>
    </Card>
  );
}

function SharePlan({ trip }: { trip: TripDetail }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const place = trip.destinations.find((d) => d.id === trip.locked_destination_id)?.title ?? 'a place to be decided';
  const dates = trip.locked_start && trip.locked_end ? formatTripDates(trip.locked_start, trip.locked_end) : '';
  const message = planMessage(trip.name, dates, place);

  const share = async () => {
    // Browsers without the Web Share API can't open a share sheet; copy the message instead.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      try {
        await Clipboard.setStringAsync(message);
        setCopied(true);
      } catch {}
      return;
    }
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <View style={{ gap: space.xs }}>
      <Button label="Share plan" onPress={share} />
      <Text variant="caption" tone="muted" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
        {copied ? 'Copied!' : ' '}
      </Text>
    </View>
  );
}

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(80 + index * 70).springify().damping(16)}
      style={styles.section}>
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      {children}
    </Animated.View>
  );
}

function MemberRow({ member, fill, isMe }: { member: TripMember; fill: string; isMe: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.member} accessible accessibilityLabel={`${member.display_name}${isMe ? ', you' : ''}${member.role === 'organiser' ? ', organiser' : ''}`}>
      <Avatar name={member.display_name} url={member.avatar_url} color={member.avatar_color} fallbackColor={fill} size={36} />
      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
        {member.display_name}
        {isMe ? <Text tone="muted"> (you)</Text> : null}
      </Text>
      {member.role === 'organiser' ? (
        <View style={[styles.tag, { backgroundColor: colors.cardMuted }]}>
          <Text variant="caption" tone="secondary" style={{ fontWeight: '600' }}>
            Organiser
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function WhenCard({ trip }: { trip: TripDetail }) {
  if (trip.status === 'locked' && trip.locked_start && trip.locked_end) {
    const nights = nightsBetween(trip.locked_start, trip.locked_end);
    return (
      <Card style={{ gap: 2 }}>
        <Text variant="heading">{formatTripDates(trip.locked_start, trip.locked_end)}</Text>
        <Text variant="caption" tone="muted">
          {nights === 0 ? 'Day trip' : `${nights} ${nights === 1 ? 'night' : 'nights'}`}
        </Text>
      </Card>
    );
  }
  const n = trip.availabilityCount;
  const best = trip.bestDays;
  return (
    <Card style={{ gap: space.sm }}>
      {best.length > 0 ? (
        <View style={{ gap: 2 }}>
          <Text variant="caption" tone="muted">
            Best days so far
          </Text>
          {best.map((r) => (
            <Text key={r.start} variant="heading">
              {formatRange(r.start, r.end)}
              <Text variant="caption" tone="muted">
                {'  '}
                {r.free} of {trip.members.length} free
              </Text>
            </Text>
          ))}
        </View>
      ) : null}
      <Text variant={best.length > 0 ? 'caption' : 'bodyStrong'} tone={best.length > 0 ? 'muted' : 'primary'}>
        {n === 0 ? 'Nobody has marked their days yet' : `${n} of ${trip.members.length} ${n === 1 ? 'has' : 'have'} marked their free days`}
      </Text>
      <Button
        label="Mark my days"
        variant="secondary"
        onPress={() => router.push({ pathname: '/trip/[id]/days', params: { id: trip.id } })}
        accessibilityHint="Opens the calendar to mark and compare free days"
      />
    </Card>
  );
}

function WhereCard({ trip }: { trip: TripDetail }) {
  const { colors } = useTheme();
  if (trip.status === 'locked') {
    const locked = trip.destinations.find((d) => d.id === trip.locked_destination_id);
    if (!locked) {
      return (
        <Card>
          <Text variant="body" tone="secondary">
            The chosen place is no longer available.
          </Text>
        </Card>
      );
    }
    return (
      <Card style={{ gap: space.sm, padding: 0, overflow: 'hidden' }}>
        <PlacePhoto place={locked} accessibilityLabel={`Photo of ${locked.title}`} style={[styles.placeImage, { backgroundColor: colors.cardMuted }]} />
        <View style={{ gap: space.xs, padding: space.lg, paddingTop: locked.photoUrl ? space.xs : space.lg }}>
          <Text variant="heading">{locked.title}</Text>
          {locked.note ? (
            <Text variant="body" tone="secondary">
              {locked.note}
            </Text>
          ) : null}
          {locked.url ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open link, ${hostOf(locked.url)}`}
              onPress={() => Linking.openURL(locked.url!).catch(() => {})}
              hitSlop={8}>
              <Text variant="label" tone="accent">
                {hostOf(locked.url)} ↗
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>
    );
  }
  const suggest = () => router.push({ pathname: '/trip/[id]/suggest', params: { id: trip.id } });
  if (trip.destinations.length === 0) {
    return (
      <Card style={{ gap: space.sm }}>
        <View style={{ gap: 2 }}>
          <Text variant="bodyStrong">No destinations yet</Text>
          <Text variant="caption" tone="muted">
            Suggest a place, then everyone votes.
          </Text>
        </View>
        <Button label="Suggest a place" onPress={suggest} />
      </Card>
    );
  }
  return (
    <Card style={{ paddingVertical: space.sm, gap: space.xs }}>
      {trip.destinations.slice(0, 3).map((d, i) => (
        <View
          key={d.id}
          style={[styles.destination, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}
          accessible
          accessibilityLabel={`${d.title}, ${d.voteCount} ${d.voteCount === 1 ? 'vote' : 'votes'}`}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {d.title}
            </Text>
            {d.note ? (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {d.note}
              </Text>
            ) : null}
          </View>
          <View style={[styles.votes, { backgroundColor: colors.votes }]}>
            <Text variant="caption" tone="onColor" style={{ fontWeight: '700' }}>
              {d.voteCount}
            </Text>
          </View>
        </View>
      ))}
      <View style={styles.whereActions}>
        <View style={{ flex: 1 }}>
          <Button label="Suggest a place" variant="secondary" onPress={suggest} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={trip.destinations.length > 3 ? `See all ${trip.destinations.length} & vote` : 'See all & vote'}
            onPress={() => router.push({ pathname: '/trip/[id]/places', params: { id: trip.id } })}
          />
        </View>
      </View>
    </Card>
  );
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { trip, loading, error, refresh } = useTrip(id, session?.user.id);
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useTripLive(id, refresh);

  // If the trip disappears while you're looking at it (the organiser deleted it), go back to your trips.
  const hadTrip = useRef(false);
  useEffect(() => {
    if (trip) hadTrip.current = true;
    else if (hadTrip.current && !loading && !error) router.replace('/');
  }, [trip, loading, error]);

  if (loading && !trip) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading trip" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen footer={<Button label={error ? 'Try again' : 'Back to your trips'} onPress={error ? refresh : goBack} />}>
        <BackButton />
        <View style={[styles.center, { gap: space.sm }]}>
          <Text variant="title" style={{ textAlign: 'center' }}>
            {error ? 'Something went wrong' : 'Trip not found'}
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            {error ?? "This trip doesn't exist, or you're not a member of it."}
          </Text>
        </View>
      </Screen>
    );
  }

  const fill = tripColors[trip.color] ?? tripColors.sunset;
  const isLocked = trip.status === 'locked';
  const isOrganiser = trip.members.some((m) => m.user_id === session?.user.id && m.role === 'organiser');

  return (
    <Screen>
      <Animated.View
        entering={reduced ? undefined : FadeInDown.springify().damping(16)}
        style={[styles.hero, { backgroundColor: fill }]}>
        <View style={styles.heroTop}>
          <BackButton />
          <View style={styles.heroActions}>
            <View style={[styles.pill, { backgroundColor: colors.onColor }]}>
              <Text variant="caption" style={{ color: fill, fontWeight: '600' }}>
                {isLocked ? 'Locked in' : 'Planning'}
              </Text>
            </View>
            <SettingsButton tripId={trip.id} />
          </View>
        </View>
        <Text variant="title" tone="onColor" numberOfLines={3}>
          {trip.name}
        </Text>
      </Animated.View>

      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: space.md }}>
          {error}
        </Text>
      ) : null}

      {isLocked ? (
        <View style={{ marginTop: space.xl }}>
          <SharePlan trip={trip} />
        </View>
      ) : (
        <Section title="Invite code" index={0}>
          <InviteCard trip={trip} />
        </Section>
      )}

      <Section title={isLocked ? 'Dates' : 'When'} index={1}>
        <WhenCard trip={trip} />
      </Section>

      <Section title={isLocked ? 'Destination' : 'Where'} index={2}>
        <WhereCard trip={trip} />
      </Section>

      {isOrganiser && !isLocked ? (
        <Section title="Ready to decide?" index={3}>
          <Card style={{ gap: space.sm }}>
            <Text variant="caption" tone="muted">
              Pick the dates and the place. Everyone sees the final plan and voting stops.
            </Text>
            <Button label="Lock in the plan" color={fill} onPress={() => router.push({ pathname: '/trip/[id]/lock', params: { id: trip.id } })} />
          </Card>
        </Section>
      ) : null}

      <Section title={`Who's going · ${trip.members.length}`} index={4}>
        <Card style={{ paddingVertical: space.sm }}>
          {trip.members.map((m) => (
            <MemberRow key={m.user_id} member={m} fill={fill} isMe={m.user_id === session?.user.id} />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radius.lg, padding: space.xl, paddingTop: space.lg, minHeight: 190, justifyContent: 'space-between', gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  section: { marginTop: space.xl, gap: space.sm },
  invite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  inviteActions: { flexDirection: 'row', gap: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TOUCH, paddingVertical: space.xs },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: MIN_TOUCH },
  whereActions: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  placeImage: { width: '100%', aspectRatio: 16 / 9 },
  votes: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center' },
});
