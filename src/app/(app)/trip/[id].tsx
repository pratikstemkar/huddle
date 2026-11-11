import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { inviteMessage, useTrip, type TripDetail, type TripMember } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

/** Formats a Postgres `date` (YYYY-MM-DD) without shifting it into the local timezone. */
function formatDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

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
      <View style={[styles.initial, { backgroundColor: fill }]}>
        <Text variant="label" tone="onColor">
          {member.display_name.charAt(0).toUpperCase()}
        </Text>
      </View>
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
  if (trip.status === 'locked' && trip.locked_start) {
    const range =
      trip.locked_end && trip.locked_end !== trip.locked_start
        ? `${formatDay(trip.locked_start)} – ${formatDay(trip.locked_end)}`
        : formatDay(trip.locked_start);
    return (
      <Card>
        <Text variant="heading">{range}</Text>
      </Card>
    );
  }
  const n = trip.availabilityCount;
  return (
    <Card style={{ gap: space.xs }}>
      <Text variant="bodyStrong">
        {n === 0 ? 'Nobody has marked their days yet' : `${n} of ${trip.members.length} ${n === 1 ? 'has' : 'have'} marked their free days`}
      </Text>
      <Text variant="caption" tone="muted">
        Marking days is coming soon.
      </Text>
    </Card>
  );
}

function WhereCard({ trip }: { trip: TripDetail }) {
  const { colors } = useTheme();
  const locked = trip.status === 'locked' ? trip.destinations.find((d) => d.id === trip.locked_destination_id) : undefined;
  if (locked) {
    return (
      <Card style={{ gap: space.xs }}>
        <Text variant="heading">{locked.title}</Text>
        {locked.note ? (
          <Text variant="body" tone="secondary">
            {locked.note}
          </Text>
        ) : null}
      </Card>
    );
  }
  if (trip.destinations.length === 0) {
    return (
      <Card style={{ gap: space.xs }}>
        <Text variant="bodyStrong">No destinations yet</Text>
        <Text variant="caption" tone="muted">
          Suggesting and voting on places is coming soon.
        </Text>
      </Card>
    );
  }
  return (
    <Card style={{ paddingVertical: space.sm }}>
      {trip.destinations.map((d, i) => (
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
    </Card>
  );
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip, loading, error, refresh } = useTrip(id);
  const { session } = useAuth();
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

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

  return (
    <Screen>
      <Animated.View
        entering={reduced ? undefined : FadeInDown.springify().damping(16)}
        style={[styles.hero, { backgroundColor: fill }]}>
        <View style={styles.heroTop}>
          <BackButton />
          <View style={[styles.pill, { backgroundColor: colors.onColor }]}>
            <Text variant="caption" style={{ color: fill, fontWeight: '600' }}>
              {isLocked ? 'Locked in' : 'Planning'}
            </Text>
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

      <Section title="Invite code" index={0}>
        <InviteCard trip={trip} />
      </Section>

      <Section title={isLocked ? 'Dates' : 'When'} index={1}>
        <WhenCard trip={trip} />
      </Section>

      <Section title={isLocked ? 'Destination' : 'Where'} index={2}>
        <WhereCard trip={trip} />
      </Section>

      <Section title={`Who's going · ${trip.members.length}`} index={3}>
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
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  section: { marginTop: space.xl, gap: space.sm },
  invite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  inviteActions: { flexDirection: 'row', gap: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TOUCH, paddingVertical: space.xs },
  initial: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: MIN_TOUCH },
  votes: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center' },
});
