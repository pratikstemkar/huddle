import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { useRegisterPipAction } from '@/components/nav/pip-action';
import { Pip } from '@/components/pip/pip';
import { BalanceCard } from '@/components/split/balance-card';
import { MyLines } from '@/components/split/my-lines';
import { confirmAction, nameMap } from '@/components/split/people';
import { SplitFeed } from '@/components/split/split-feed';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { useTripLive } from '@/lib/realtime';
import { splitFeed, undoSettlement, useSplit } from '@/lib/split';
import { useTrip } from '@/lib/trips';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const LIVE_TABLES = ['expenses', 'settlements', 'trip_members'] as const;

export default function SplitTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading: tripLoading, error: tripError, refresh: refreshTrip } = useTrip(id, me);
  const split = useSplit(id, me);
  const { refresh: refreshSplit } = split;
  const [undoError, setUndoError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    refreshTrip();
    refreshSplit();
  }, [refreshTrip, refreshSplit]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useTripLive(id, refresh, [...LIVE_TABLES]);

  const addExpense = useCallback(() => {
    if (id) router.push({ pathname: '/trip/[id]/expense', params: { id } });
  }, [id]);
  useRegisterPipAction('Add expense', addExpense);

  const net = split.lines?.net ?? 0;
  const settlementCount = split.settlements.length;
  const [cheer, setCheer] = useState(0);
  const prev = useRef<{ net: number; settlements: number } | null>(null);
  useEffect(() => {
    if (split.loading) return;
    const p = prev.current;
    if (p && p.net !== 0 && net === 0 && p.settlements !== settlementCount) setCheer((c) => c + 1);
    prev.current = { net, settlements: settlementCount };
  }, [net, settlementCount, split.loading]);

  const names = useMemo(() => nameMap(trip?.members ?? []), [trip?.members]);
  const feed = useMemo(() => splitFeed(split.expenses, split.settlements), [split.expenses, split.settlements]);

  if ((tripLoading && !trip) || split.loading) {
    return (
      <Screen withNav scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen withNav>
        <Text variant="title">Split</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          {tripError ?? "This trip doesn't exist, or you're not a member of it."}
        </Text>
        {tripError ? <Button label="Try again" variant="outline" onPress={refresh} style={{ marginTop: space.lg }} /> : null}
      </Screen>
    );
  }

  const currency = trip.currency || 'INR';
  const isOrganiser = trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const empty = !split.loading && !split.error && feed.length === 0;

  const settle = () => router.push({ pathname: '/trip/[id]/settle', params: { id: trip.id } });
  const editExpense = (expense: string) => router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id, expense } });
  const undo = async (settlementId: string) => {
    const ok = await confirmAction('Undo this payment?', 'It comes off the balances for everyone.', 'Undo');
    if (!ok) return;
    setUndoError(null);
    try {
      await undoSettlement(settlementId);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshSplit();
    } catch {
      setUndoError("Couldn't undo that payment. Check your connection and try again.");
    }
  };

  return (
    <Screen withNav contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {`${trip.name} · ${formatMoney(split.spent, currency)} spent`}
          </Text>
          <Text variant="title">Split</Text>
        </View>
        <Button
          label="Add expense"
          size="sm"
          icon={<Icon name="plus" size={18} color={colors.onIris} />}
          onPress={addExpense}
          style={styles.add}
        />
      </View>

      {split.error ? (
        <Card style={{ gap: space.md }}>
          <Text variant="body" tone="secondary" accessibilityLiveRegion="polite">
            {split.error}
          </Text>
          <Button label="Try again" variant="outline" size="sm" onPress={refreshSplit} />
        </Card>
      ) : null}

      {empty ? (
        <Card style={styles.empty}>
          <Pip mood="snooze" size={120} />
          <Text variant="body" tone="secondary" style={styles.emptyText}>
            No expenses yet. Add the first one and Huddle does the maths.
          </Text>
        </Card>
      ) : !split.error ? (
        <>
          <BalanceCard net={net} currency={currency} onSettle={settle} cheer={cheer} />
          {split.lines ? <MyLines owedToMe={split.lines.owedToMe} iOwe={split.lines.iOwe} names={names} currency={currency} /> : null}
          {undoError ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {undoError}
            </Text>
          ) : null}
          <SplitFeed
            items={feed}
            names={names}
            me={me}
            currency={currency}
            isOrganiser={isOrganiser}
            onEditExpense={editExpense}
            onUndoSettlement={undo}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  headerText: { flex: 1, minWidth: 0, gap: space.xs },
  add: { paddingHorizontal: space.lg },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyText: { textAlign: 'center' },
});
