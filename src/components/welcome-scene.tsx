import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Pip, type PipMood } from '@/components/pip/pip';
import { MAX_CONTENT_WIDTH, palette, radius, space } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

const CLOUD = 'M18 36a14 14 0 0 1 4-27 18 18 0 0 1 34 2 12 12 0 0 1 22 9 9 9 0 0 1 4 16z';
/** The iris ground stays the light-mode iris in both schemes. */
const GROUND = palette.light.iris;
const CLOUD_FILL = palette.dark.iris;
const PIP_SIZE = 200;
const PIP_HEIGHT = (PIP_SIZE * 124) / 120;

type CloudProps = { width: number; height: number; top: number; duration: number; offset: number; span: number; reduced: boolean };

function Cloud({ width, height, top, duration, offset, span, reduced }: CloudProps) {
  const progress = useSharedValue(reduced ? 0 : offset);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(progress);
      progress.set(0);
      return;
    }
    progress.set(offset);
    progress.set(
      withSequence(
        withTiming(1, { duration: duration * (1 - offset), easing: Easing.linear }),
        withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.linear })), -1, false),
      ),
    );
    return () => cancelAnimation(progress);
  }, [reduced, duration, offset, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: reduced ? 0 : -140 + progress.value * (span + 210) }],
  }));

  return (
    <Animated.View testID="welcome-cloud" style={[styles.cloud, { top, width, height }, style]}>
      <Svg width={width} height={height} viewBox="0 0 100 40">
        <Path d={CLOUD} fill={CLOUD_FILL} />
      </Svg>
    </Animated.View>
  );
}

type Props = {
  /** What goes on the sheet. */
  children: ReactNode;
  pipMood?: PipMood;
  scarf?: string;
  tail?: string;
  pipLabel?: string;
};

/** The Welcome layout: iris sky with drifting clouds and Pip, and a rounded sheet below. */
export function WelcomeScene({ children, pipMood = 'hello', scarf, tail, pipLabel = 'Pip the penguin waving hello' }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const beak = colors.beak;

  return (
    <View style={[styles.root, { backgroundColor: GROUND }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.sky, { paddingTop: insets.top, minHeight: PIP_HEIGHT + space.sm + insets.top }]}>
          <View style={[styles.clouds, { top: 120 + insets.top }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Cloud width={100} height={40} top={0} duration={14000} offset={0} span={width} reduced={reduced} />
            <Cloud width={70} height={28} top={70} duration={20000} offset={0.4} span={width} reduced={reduced} />
          </View>
          <Pip mood={pipMood} size={PIP_SIZE} scarf={scarf ?? beak} tail={tail ?? beak} accessibilityLabel={pipLabel} />
        </View>
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(44, insets.bottom + space.xl) }]}>
          <View style={styles.column}>{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  scroll: { flexGrow: 1 },
  sky: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space.sm },
  clouds: { position: 'absolute', left: 0, right: 0, height: 120 },
  cloud: { position: 'absolute', left: 0 },
  sheet: {
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
  },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: 22 },
});
