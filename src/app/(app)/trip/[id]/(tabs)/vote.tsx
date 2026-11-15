import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { DatesPanel } from '@/components/vote/dates-panel';
import { PanelLoading } from '@/components/vote/panel-loading';
import { PlacesPanel } from '@/components/vote/places-panel';
import { useAuth } from '@/lib/auth';
import { useTrip } from '@/lib/trips';
import { space } from '@/theme/tokens';
import { useTripId } from '@/components/nav/trip-id';

type Seg = 'places' | 'dates';

const toSeg = (s: string | undefined): Seg => (s === 'dates' ? 'dates' : 'places');

export default function VoteTab() {
  const id = useTripId();
  const { seg: segParam } = useLocalSearchParams<{ seg?: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { trip, loading, error, refresh } = useTrip(id, me);
  const [seg, setSeg] = useState<Seg>(() => toSeg(segParam));

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // A link to `vote?seg=dates` switches the segment even when the tab is already open.
  const [lastParam, setLastParam] = useState(segParam);
  if (segParam !== lastParam) {
    setLastParam(segParam);
    if (segParam) setSeg(toSeg(segParam));
  }

  const header = useCallback(
    (kicker: string) => (
      <>
        <View style={styles.titles}>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {kicker}
          </Text>
          <Text variant="title">{seg === 'places' ? 'Where should we go?' : 'When can we go?'}</Text>
        </View>
        <Segmented
          options={[
            { value: 'places', label: 'Places' },
            { value: 'dates', label: 'Dates' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </>
    ),
    [seg],
  );

  if (loading && !trip) {
    return (
      <Screen withNav contentStyle={styles.center}>
        <PanelLoading label="Loading trip" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen withNav contentStyle={styles.content}>
        <View style={styles.missing}>
          <Pip mood="snooze" size={96} />
          <Text variant="titleSm" style={styles.centerText}>
            {error ? 'Something went wrong' : 'Trip not found'}
          </Text>
          <Text variant="body" tone="secondary" style={styles.centerText}>
            {error ?? "This trip doesn't exist, or you're not a member of it."}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen withNav contentStyle={styles.content}>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {seg === 'places' ? (
        <PlacesPanel trip={trip} me={me} refreshTrip={refresh} header={header} />
      ) : (
        <DatesPanel trip={trip} me={me} refreshTrip={refresh} header={header} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.section, paddingTop: space.xl },
  center: { justifyContent: 'center' },
  titles: { gap: space.xs },
  missing: { alignItems: 'center', gap: space.sm, paddingTop: space.xxl },
  centerText: { textAlign: 'center' },
});
