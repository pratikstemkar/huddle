import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { PipHint } from '@/components/nav/pip-hint';
import { Pip } from '@/components/pip/pip';
import { useTourTarget } from '@/components/tour/tour';
import { Icon } from '@/components/ui/icon';
import { NAV_HEIGHT, shadow, springs } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

type Props = {
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Nothing to do: Pip just bobs. */
  onPress?: () => void;
  /** Lines Pip says in a bubble that pops up and fades, one picked at random each time; also marks the button with a "+". */
  hints?: readonly string[];
  /** Change it to show the bubble again, e.g. the current path. */
  hintKey?: string;
  /** Lets a guided tour point at the button. */
  tourId?: string;
};

/** The round beak-yellow Pip button at the end of the tab bar. */
export function PipButton({ accessibilityLabel, accessibilityHint, onPress, hints, hintKey, tourId }: Props) {
  const { colors, scheme } = useTheme();
  const tour = useTourTarget(tourId);
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const press = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reduced) bob.set(withSequence(withTiming(6, { duration: 90 }), withSpring(0, springs.pip)));
    onPress?.();
  };

  return (
    <View {...tour} style={[styles.shadow, { boxShadow: shadow[scheme].pipButton }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={press}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.beak, opacity: pressed ? 0.9 : 1 }]}>
        <Animated.View style={bobStyle}>
          <Pip crop="peek" size={56} />
        </Animated.View>
      </Pressable>
      {hints?.length ? (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: colors.ink, borderColor: colors.beak }]}>
          <Icon name="plus" size={12} color={colors.onInk} />
        </View>
      ) : null}
      {hints?.length ? <PipHint labels={hints} replayKey={hintKey} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  shadow: { width: NAV_HEIGHT, height: NAV_HEIGHT, borderRadius: NAV_HEIGHT / 2, flexShrink: 0 },
  button: {
    width: NAV_HEIGHT,
    height: NAV_HEIGHT,
    borderRadius: NAV_HEIGHT / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
});
