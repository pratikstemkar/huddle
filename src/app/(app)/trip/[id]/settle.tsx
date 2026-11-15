import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { useMoneyNames } from '@/components/split/people';
import { closeSheet, SheetHeader } from '@/components/split/sheet-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';
import { amountInput, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { recordSettlement, useSplit, type Transfer } from '@/lib/split';
import { useTrip, type TripMember } from '@/lib/trips';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Line = { key: string; transfer: Transfer; text: string; action: string; name: string; iOwe: boolean };

const NO_MEMBERS: TripMember[] = [];

export default function SettleSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading: tripLoading, refresh: refreshTrip } = useTrip(id, me);
  const { lines: mine, expenses, settlements, loading: splitLoading, error: splitError, refresh: refreshSplit } = useSplit(id, me);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshTrip();
      refreshSplit();
    }, [refreshTrip, refreshSplit]),
  );

  const names = useMoneyNames(trip?.members ?? NO_MEMBERS, expenses, settlements);

  if ((tripLoading && !trip) || splitLoading) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  if (!trip || splitError) {
    return (
      <Screen footer={<Button label="Close" onPress={() => closeSheet(id)} />}>
        <SheetHeader title="Settle up" tripId={id} />
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          {splitError ?? "This trip doesn't exist, or you're not a member of it."}
        </Text>
      </Screen>
    );
  }

  const currency = trip.currency || 'INR';
  const nameOf = (u: string) => names.get(u) ?? 'Someone';
  const lines: Line[] = [
    ...(mine?.iOwe ?? []).map((t) => ({
      key: `out:${t.to}`,
      transfer: t,
      name: nameOf(t.to),
      iOwe: true,
      text: `You owe ${nameOf(t.to)}`,
      action: `I paid ${nameOf(t.to)}`,
    })),
    ...(mine?.owedToMe ?? []).map((t) => ({
      key: `in:${t.from}`,
      transfer: t,
      name: nameOf(t.from),
      iOwe: false,
      text: `${nameOf(t.from)} owes you`,
      action: `${nameOf(t.from)} paid me`,
    })),
  ];

  if (!lines.length) {
    return (
      <Screen footer={<Button label="Close" onPress={() => closeSheet(id)} />} contentStyle={styles.content}>
        <SheetHeader title="Settle up" tripId={id} />
        <View style={styles.square}>
          <Pip mood="yay" size={120} />
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            You&apos;re all square. Nothing to settle.
          </Text>
        </View>
      </Screen>
    );
  }

  const settle = async (line: Line) => {
    const owed = line.transfer.amount_minor;
    const typed = amounts[line.key];
    const minor = typed === undefined ? owed : parseAmount(typed);
    const fail = (message: string) => setErrors((e) => ({ ...e, [line.key]: message }));
    if (minor === null) return fail(`Enter an amount, like ${amountInput(owed)}.`);
    if (minor > owed) {
      return fail(
        line.iOwe
          ? `That's more than you owe ${line.name}. The most is ${formatMoney(owed, currency)}.`
          : `That's more than ${line.name} owes you. The most is ${formatMoney(owed, currency)}.`,
      );
    }
    setErrors((e) => ({ ...e, [line.key]: '' }));
    setSaving(line.key);
    try {
      await recordSettlement(trip.id, line.transfer.from, line.transfer.to, minor);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeSheet(id);
    } catch {
      fail("Couldn't record that payment. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title="Settle up" tripId={id} />
      <Text variant="body" tone="secondary">
        Paid someone back? Record it here. You can record part of it.
      </Text>
      {lines.map((line) => {
        const owed = formatMoney(line.transfer.amount_minor, currency);
        const error = errors[line.key];
        return (
          <Card key={line.key} style={styles.line}>
            <View style={styles.lineHead}>
              <Text variant="label" style={{ flex: 1 }}>
                {line.text}
              </Text>
              <Text variant="label" tone={line.iOwe ? 'owe' : 'positive'}>
                {owed}
              </Text>
            </View>
            <View
              style={[
                styles.amount,
                { backgroundColor: colors.card },
                error ? { borderWidth: 2, borderColor: colors.danger } : { borderWidth: 1, borderColor: colors.lineStrong },
              ]}>
              <Text variant="numberSm" tone="secondary">
                {currencySymbol(currency)}
              </Text>
              <TextInput
                value={amounts[line.key] ?? amountInput(line.transfer.amount_minor)}
                onChangeText={(t) => {
                  setAmounts((a) => ({ ...a, [line.key]: t }));
                  if (error) setErrors((e) => ({ ...e, [line.key]: '' }));
                }}
                accessibilityLabel={`Amount, ${line.text}`}
                keyboardType="decimal-pad"
                inputMode="decimal"
                maxLength={16}
                style={[styles.amountInput, { color: colors.text }]}
              />
            </View>
            {error ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label={line.action}
              size="md"
              loading={saving === line.key}
              onPress={() => (saving ? undefined : settle(line))}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.lg },
  square: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  line: { gap: space.md },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  amount: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingHorizontal: space.s18, borderRadius: radius.lg },
  amountInput: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '600', paddingVertical: space.sm },
});
