import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { onTripColor, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

type Piece = { left: `${number}%`; color: string | null; round?: boolean; delay: number; spin: number };

/** Five strips and one ink dot (null colour), spread across the top like the Locked artboard (x 40…330 of 390). */
const PIECES: Piece[] = [
  { left: '10%', color: tripColors.iris, delay: 0, spin: 320 },
  { left: '28%', color: onTripColor.iris, delay: 700, spin: -280 },
  { left: '49%', color: tripColors.blush, delay: 300, spin: 300 },
  { left: '67%', color: tripColors.iris, delay: 1100, spin: -320 },
  { left: '85%', color: onTripColor.iris, delay: 450, spin: 260 },
  { left: '58%', color: null, round: true, delay: 1500, spin: 0 },
];

const DURATION = 2200;
const FALL = 420;

function Bit({ piece, still, ink }: { piece: Piece; still: boolean; ink: string }) {
  const t = useSharedValue(still ? 0.1 + piece.delay / 5000 : 0);

  useEffect(() => {
    if (still) return;
    t.set(withDelay(piece.delay, withRepeat(withTiming(1, { duration: DURATION, easing: Easing.linear }), -1, false)));
    return () => cancelAnimation(t);
  }, [still, piece.delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: still ? 1 : t.value < 0.1 ? t.value * 10 : t.value > 0.85 ? (1 - t.value) / 0.15 : 1,
    transform: [{ translateY: -20 + t.value * FALL }, { rotate: `${t.value * piece.spin}deg` }],
  }));

  return <Animated.View style={[piece.round ? styles.dot : styles.strip, { left: piece.left, backgroundColor: piece.color ?? ink }, style]} />;
}

/** Falling confetti behind the celebration. Holds still with Reduce Motion. */
export function Confetti() {
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PIECES.map((p, i) => (
        <Bit key={i} piece={p} still={reduced} ink={colors.onBeak} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, top: 0, height: FALL },
  strip: { position: 'absolute', top: 0, width: 10, height: 16, borderRadius: 3 },
  dot: { position: 'absolute', top: 0, width: 12, height: 12, borderRadius: 6 },
});
