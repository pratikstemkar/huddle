import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/money';
import type { Transfer } from '@/lib/split';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  owedToMe: Transfer[];
  iOwe: Transfer[];
  names: Map<string, string>;
  currency: string;
};

type Line = { key: string; label: string; amount: number; owe: boolean };

/** The payments that involve me, two to a row: "Arjun owes you ₹1,850", "You owe Zoe ₹600". */
export function MyLines({ owedToMe, iOwe, names, currency }: Props) {
  const { colors } = useTheme();
  const lines: Line[] = [
    ...owedToMe.map((t) => ({ key: `in:${t.from}`, label: `${names.get(t.from) ?? 'Someone'} owes you`, amount: t.amount_minor, owe: false })),
    ...iOwe.map((t) => ({ key: `out:${t.to}`, label: `You owe ${names.get(t.to) ?? 'Someone'}`, amount: t.amount_minor, owe: true })),
  ];
  if (!lines.length) return null;

  const rows: Line[][] = [];
  for (let i = 0; i < lines.length; i += 2) rows.push(lines.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].key} style={styles.row}>
          {row.map((l) => {
            const amount = formatMoney(l.amount, currency);
            return (
              <View
                key={l.key}
                accessible
                accessibilityLabel={`${l.label} ${amount}`}
                style={[styles.cell, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {l.label}
                </Text>
                <Text variant="bodyStrong" tone={l.owe ? 'owe' : 'positive'}>
                  {amount}
                </Text>
              </View>
            );
          })}
          {row.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.s14, gap: space.xxs },
  spacer: { flex: 1 },
});
