import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GroupCard } from '@/components/groups/group-card';
import { HangoutInviteRow, InviteRow, TripInviteRow } from '@/components/groups/invite-row';
import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useMyHangouts, waitingOnMe } from '@/lib/hangouts';
import { acceptGroupInvite, groupsSummary, removeGroupInvite, useGroups, useGroupsLive, type GroupInvite } from '@/lib/groups';
import { acceptTripInvite, removeTripInvite, useMyTripInvites, type TripInvite } from '@/lib/trip-invites';
import { space } from '@/theme/tokens';

export default function Groups() {
  const { session } = useAuth();
  const me = session?.user.id;
  const { groups, invites, loading, error, refresh } = useGroups(me);
  const { invites: tripInvites, error: tripError, refresh: refreshTrips } = useMyTripInvites();
  const { hangouts, error: hangoutError, refresh: refreshHangouts } = useMyHangouts();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshTrips();
      refreshHangouts();
    }, [refresh, refreshTrips, refreshHangouts]),
  );
  useGroupsLive(!!me, () => {
    refresh();
    refreshTrips();
    refreshHangouts();
  });

  const answer = async (invite: GroupInvite, join: boolean) => {
    setBusy(invite.group_id);
    setActionError(null);
    try {
      if (join) await acceptGroupInvite(invite.group_id);
      else if (me) await removeGroupInvite(invite.group_id, me);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't answer that invite.");
    } finally {
      setBusy(null);
    }
  };

  const answerTrip = async (invite: TripInvite, join: boolean) => {
    setBusy(invite.trip_id);
    setActionError(null);
    try {
      if (join) {
        const tripId = await acceptTripInvite(invite.trip_id);
        router.push({ pathname: '/trip/[id]', params: { id: tripId } });
      } else if (me) {
        await removeTripInvite(invite.trip_id, me);
      }
      await refreshTrips();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't answer that invite.");
    } finally {
      setBusy(null);
    }
  };

  const hangoutsWaiting = waitingOnMe(hangouts);
  const waiting = invites.length + tripInvites.length + hangoutsWaiting.length;
  const firstLoad = loading && groups.length === 0 && waiting === 0;

  return (
    <Screen withNav>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="callout" tone="secondary">
              {groupsSummary(waiting, groups.length)}
            </Text>
            <Text variant="title">Your people</Text>
          </View>
          <Button label="New group" icon="plus" size="sm" onPress={() => router.push('/new-group')} />
        </View>

        {firstLoad ? (
          <View style={styles.loading}>
            <Pip mood="hmm" size={96} />
            <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
              Loading your groups
            </Text>
          </View>
        ) : (
          <>
            {error || tripError || hangoutError || actionError ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error ?? tripError ?? hangoutError ?? actionError}
              </Text>
            ) : null}

            {waiting > 0 ? (
              <View style={styles.section}>
                <Text variant="label" accessibilityRole="header">
                  Waiting on you
                </Text>
                {invites.map((i) => (
                  <InviteRow key={i.group_id} invite={i} busy={busy === i.group_id} onJoin={() => answer(i, true)} onDecline={() => answer(i, false)} />
                ))}
                {tripInvites.map((i) => (
                  <TripInviteRow key={i.trip_id} invite={i} busy={busy === i.trip_id} onJoin={() => answerTrip(i, true)} onDecline={() => answerTrip(i, false)} />
                ))}
                {hangoutsWaiting.map((h) => (
                  <HangoutInviteRow key={h.id} hangout={h} onOpen={() => router.push({ pathname: '/hangout/[id]', params: { id: h.id } })} />
                ))}
              </View>
            ) : (
              <SpeechCard>{groups.length === 0 ? 'Make a group for the people you plan with, and trips get easier.' : 'All caught up. New invites land here.'}</SpeechCard>
            )}

            <View style={styles.section}>
              <Text variant="label" accessibilityRole="header">
                Your groups
              </Text>
              {groups.length === 0 ? (
                <Card style={styles.empty}>
                  <Text variant="cardTitle">No groups yet</Text>
                  <Text variant="callout" tone="secondary">
                    A group is the crew you keep planning with: flatmates, college friends, cousins.
                  </Text>
                </Card>
              ) : (
                groups.map((g) => <GroupCard key={g.id} group={g} />)
              )}
              <Button label="Join with a code" variant="outline" size="sm" icon="link" onPress={() => router.push('/join')} />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  headerText: { flex: 1, gap: space.xxs },
  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl },
  section: { gap: space.s10 },
  empty: { gap: space.sm },
});
