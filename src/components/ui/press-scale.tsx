import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { springs } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Subtle: 0.95-0.98. */
  pressedScale?: number;
};

/** A Pressable that shrinks a little while held, so every tap shows it landed. Springs back on release. */
export function PressableScale({ pressedScale = 0.97, style, disabled, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const to = (value: number) => {
    scale.set(reduced ? withTiming(value, { duration: 80 }) : withSpring(value, springs.press));
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) to(pressedScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, animated]}
      {...rest}
    />
  );
}
