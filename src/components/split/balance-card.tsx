import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/money';
import { palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  /** What I'm owed minus what I owe, in minor units. */
  net: number;
  currency: string;
  onSettle: () => void;
  /** Bumped when a settlement has just brought me to zero: Pip cheers once. */
  cheer: number;
};

const PIP_SIZE = 104;
const PIP_COAT = palette.dark.line;

/** The dark card at the top of Split: my balance, Pip, and "Settle up". */
export function BalanceCard({ net, currency, onSettle, cheer }: Props) {
  const { scheme, colors } = useTheme();
  const dark = scheme === 'dark';
  const fill = dark ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line } : { backgroundColor: colors.ink };
  const fg = dark ? colors.text : colors.onInk;
  const square = net === 0;
  const label = square ? "You're all square" : net > 0 ? "You're owed" : 'You owe';
  const amount = formatMoney(Math.abs(net), currency);

  return (
    <View style={[styles.card, fill]}>
      <View style={styles.text} accessible accessibilityLabel={`${label} ${amount}`}>
        <Text variant="caption" style={{ color: palette.dark.textSecondary }}>
          {label}
        </Text>
        <Text variant="display" style={{ color: fg }}>
          {amount}
        </Text>
      </View>
      {!square ? (
        <View style={styles.textAligned}>
          <Button label="Settle up" variant="beak" size="sm" onPress={onSettle} accessibilityHint="Record a payment" style={styles.settle} />
        </View>
      ) : null}
      <View style={styles.pip} pointerEvents="none">
        <Pip mood={cheer ? 'yay' : 'idle'} replay={cheer} size={PIP_SIZE} coat={PIP_COAT} wavePose={!square} />
        {!square ? (
          <Svg viewBox="0 0 120 124" width={PIP_SIZE} height={(PIP_SIZE * 124) / 120} style={StyleSheet.absoluteFill}>
            <Circle cx={110} cy={34} r={10} fill={colors.beak} />
            <Path d="M110 29v10M107 32h6" stroke={colors.onBeak} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    borderRadius: radius.xl,
    paddingTop: space.s20,
    paddingHorizontal: space.s20,
    overflow: 'hidden',
  },
  text: { gap: space.xs, alignItems: 'flex-start', marginRight: PIP_SIZE + space.sm },
  textAligned: { alignItems: 'flex-start' },
  settle: { marginTop: space.sm },
  pip: { position: 'absolute', right: space.s20, bottom: -14, width: PIP_SIZE, height: (PIP_SIZE * 124) / 120 },
});
