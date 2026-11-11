import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radius, space, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { Text } from './ui/text';

const CARDS = [
  { place: 'Goa', note: 'beach week', color: tripColors.sunset, rotate: -8, x: -80, y: -40 },
  { place: 'Manali', note: 'snow + maggi', color: tripColors.lagoon, rotate: 6, x: 72, y: -58 },
  { place: 'Pondy', note: 'long weekend', color: tripColors.mango, rotate: -3, x: -4, y: 62 },
];

function Postcard({ card, index }: { card: (typeof CARDS)[number]; index: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    bob.value = withDelay(
      index * 400,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [reduced, index, bob]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: card.x }, { translateY: card.y + bob.value }, { rotate: `${card.rotate}deg` }],
  }));

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(150 + index * 120).springify().damping(14)} style={styles.slot}>
      <Animated.View style={[styles.card, { backgroundColor: card.color }, style]}>
        <View style={[styles.stamp, { borderColor: colors.onColor }]} />
        <Text variant="heading" tone="onColor">
          {card.place}
        </Text>
        <Text variant="caption" tone="onColor">
          {card.note}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Decorative stack of floating destination postcards. Hidden from screen readers. */
export function PostcardStack() {
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {CARDS.map((card, i) => (
        <Postcard key={card.place} card={card} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 270, alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute' },
  card: { width: 150, height: 104, borderRadius: radius.md, padding: space.md, justifyContent: 'flex-end' },
  stamp: { position: 'absolute', top: space.md, right: space.md, width: 22, height: 26, borderRadius: 4, borderWidth: 1.5, borderStyle: 'dashed', opacity: 0.5 },
});
