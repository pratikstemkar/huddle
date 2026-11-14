import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Pip } from '@/components/pip/pip';
import { NAV_HEIGHT, shadow, springs } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

type Props = {
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Nothing to do: Pip just bobs. */
  onPress?: () => void;
};

/** The round beak-yellow Pip button at the end of the tab bar. */
export function PipButton({ accessibilityLabel, accessibilityHint, onPress }: Props) {
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const press = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reduced) bob.set(withSequence(withTiming(6, { duration: 90 }), withSpring(0, springs.pip)));
    onPress?.();
  };

  return (
    <View style={[styles.shadow, { boxShadow: shadow[scheme].pipButton }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
