import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRegisterPipAction } from '@/components/nav/pip-action';
import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useDestinations, type Destination } from '@/lib/destinations';
import { useTripLive } from '@/lib/realtime';
import { votedCount } from '@/lib/trip-status';
import type { TripDetail } from '@/lib/trips';
import { space } from '@/theme/tokens';
import { PanelLoading } from './panel-loading';
import { PlaceVoteCard } from './place-vote-card';

type Props = {
  trip: TripDetail;
  me: string | undefined;
  refreshTrip: () => void;
  /** The screen's kicker, title and segmented control, given this panel's kicker line. */
  header: (kicker: string) => ReactNode;
};

/** "Back as many places as you like." plus who is still to vote; or who won once voting has closed. */
export function placesPipLine(trip: TripDetail, list: Destination[], me: string | undefined): string | null {
  if (trip.status === 'locked') {
    const won = list.find((d) => d.id === trip.locked_destination_id) ?? list[0];
    return won ? `Voting's closed. ${won.title} won.` : null;
  }
  if (list.length === 0) return null;
  const voted = new Set(list.flatMap((d) => d.voters));
  const left = trip.members.filter((m) => !voted.has(m.user_id));
  const tail =
    left.length === 0
      ? ' Everyone has voted.'
      : left.length === 1
        ? left[0].user_id === me
          ? " You're the only one left to vote."
          : ` ${left[0].display_name} is the only one left to vote.`
        : ` ${left.length} still to vote.`;
  return `Back as many places as you like.${tail}`;
}

export function PlacesPanel({ trip, me, refreshTrip, header }: Props) {
  const d = useDestinations(trip.id, me);
  const refreshDestinations = d.refresh;
  const locked = trip.status === 'locked';

  useFocusEffect(
    useCallback(() => {
      refreshDestinations();
    }, [refreshDestinations]),
  );

  useTripLive(trip.id, () => {
    refreshTrip();
    refreshDestinations();
  });

  const suggest = useCallback(() => router.push({ pathname: '/trip/[id]/suggest', params: { id: trip.id } }), [trip.id]);
  useRegisterPipAction(locked ? null : 'Suggest a place', locked ? null : suggest);

  const names = useMemo(() => new Map(trip.members.map((m) => [m.user_id, m.user_id === me ? 'you' : m.display_name])), [trip.members, me]);
  const isOrganiser = trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const memberCount = trip.members.length;
  const top = d.list.reduce((n, p) => Math.max(n, p.voteCount), 0);
  const pip = placesPipLine(trip, d.list, me);

  return (
    <>
      {header(`${trip.name} · ${votedCount(d.list)} of ${memberCount} voted`)}

      {d.error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {d.error}
        </Text>
      ) : null}

      {d.loading ? (
        <PanelLoading label="Loading places" />
      ) : (
        <View style={styles.list}>
          {d.list.length === 0 ? (
            <View style={styles.empty}>
              <Pip mood="snooze" size={96} />
              <Text variant="heading" style={styles.center}>
                No places yet
              </Text>
              <Text variant="body" tone="secondary" style={styles.center}>
                Suggest somewhere to go, then everyone can vote.
              </Text>
            </View>
          ) : (
            d.list.map((dest) => (
              <PlaceVoteCard
                key={dest.id}
                destination={dest}
                names={names}
                memberCount={memberCount}
                leading={top > 0 && dest.voteCount === top}
                readOnly={locked}
                canRemove={dest.created_by === me || isOrganiser}
                onVote={() => d.toggleVote(dest.id)}
                onRemove={() => d.remove(dest.id)}
              />
            ))
          )}
          {!locked ? <Button variant="suggest" label="Suggest a place" onPress={suggest} /> : null}
        </View>
      )}

      {!d.loading && pip ? <SpeechCard>{pip}</SpeechCard> : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.listGap },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  center: { textAlign: 'center' },
});
