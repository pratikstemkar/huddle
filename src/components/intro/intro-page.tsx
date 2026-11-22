import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pip, type PipMood } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { Cloud } from '@/components/welcome-scene';
import { MAX_CONTENT_WIDTH, MIN_TOUCH, palette, radius, space, springs } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { PageDots } from './page-dots';

/** What every intro page gets from the pager. */
export type PagerProps = {
  index: number;
  count: number;
  width: number;
  /** The pager's height: each page fills it. */
  height: number;
  scrollX: SharedValue<number>;
  /** The page on screen: only it is read out, and Pip and the bubble play when it arrives. */
  active: boolean;
};

export type PipLook = { mood: PipMood; scarf: string; shades?: boolean; wavePose?: boolean };

/** The iris ground stays the light-mode iris in both schemes, as on the sign-in screen. */
const SKY = palette.light.iris;

/** Moves a layer a little faster than its page, so the content slides in with some depth. */
function Parallax({ index, width, scrollX, factor, children }: Pick<PagerProps, 'index' | 'width' | 'scrollX'> & { factor: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ translateX: 0 }] };
    const at = scrollX.value / Math.max(width, 1);
    return { transform: [{ translateX: interpolate(at, [index - 1, index, index + 1], [width * factor, 0, -width * factor], Extrapolation.CLAMP) }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Pops in each time its page arrives. */
function Pop({ active, delay = 180, children }: { active: boolean; delay?: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (reduced) shown.set(1);
    else shown.set(active ? withDelay(delay, withSpring(1, springs.gentle)) : withTiming(0, { duration: 0 }));
  }, [active, reduced, delay, shown]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value * 1.4), transform: [{ scale: 0.85 + 0.15 * shown.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Pip rests while the page is off screen; switching back to its mood plays it again each time the page arrives. */
function usePipMood(active: boolean, mood: PipMood) {
  return { mood: active ? mood : ('idle' as PipMood) };
}

function SkipLink({ color, onPress }: { color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip"
      accessibilityHint="Goes to sign in"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.skipLink, pressed && { opacity: 0.6 }]}>
      <Text variant="label" style={{ color }}>
        Skip
      </Text>
    </Pressable>
  );
}

/** Hides an off-screen page from screen readers, so only the page on screen is read out. */
function pageA11y(active: boolean) {
  return {
    'aria-hidden': !active,
    accessibilityElementsHidden: !active,
    importantForAccessibility: active ? ('auto' as const) : ('no-hide-descendants' as const),
  };
}

type SkyProps = PagerProps & { title: string; body: string; onNext: () => void; onSkip: () => void; onHaveAccount: () => void };

/** Page 1: Pip waves hello from the iris sky, as on the sign-in screen. */
export function SkyPage({ index, count, width, height, scrollX, active, title, body, onNext, onSkip, onHaveAccount }: SkyProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const pip = usePipMood(active, 'hello');
  return (
    <View testID={`intro-page-${index}`} {...pageA11y(active)} style={[styles.page, { width, height, backgroundColor: SKY }]}>
      <ScrollView contentContainerStyle={styles.grow} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={[styles.sky, { paddingTop: insets.top }]}>
          <View style={[styles.clouds, { top: 110 + insets.top }]} pointerEvents="none" aria-hidden>
            <Cloud width={100} height={40} top={0} duration={14000} offset={0} span={width} reduced={reduced} />
            <Cloud width={70} height={28} top={70} duration={20000} offset={0.4} span={width} reduced={reduced} />
          </View>
          <View style={[styles.skip, { top: insets.top + space.md }]}>
            <SkipLink color={palette.light.onIris} onPress={onSkip} />
          </View>
          <Pop active={active}>
            <View style={[styles.hello, speechStyle, { backgroundColor: colors.card }]}>
              <Text variant="heading">Hi, I’m Pip.</Text>
            </View>
          </Pop>
          <Parallax index={index} width={width} scrollX={scrollX} factor={0.35}>
            <Pip mood={pip.mood} size={180} scarf={colors.beak} tail={colors.beak} />
          </Parallax>
        </View>
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(space.xxl, insets.bottom + space.xl) }]}>
          <View style={styles.column}>
            <PageDots count={count} step={index} scrollX={scrollX} width={width} on={colors.iris} off={colors.lineStrong} />
            <View style={styles.copy}>
              <Text variant="title">{title}</Text>
              <Text variant="bodyLg" tone="secondary">
                {body}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button label="Show me around" iconRight="arrowRight" onPress={onNext} />
              <Button label="I already have an account" variant="ghost" size="md" onPress={onHaveAccount} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type FeatureProps = PagerProps & {
  title: string;
  preview: ReactNode;
  pip: PipLook;
  says: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

/** Pages 2 to 5: a feature, a small picture of it, and Pip explaining it. */
export function FeaturePage({ index, count, width, height, scrollX, active, title, preview, pip: look, says, onBack, onNext, onSkip }: FeatureProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pip = usePipMood(active, look.mood);
  return (
    <View testID={`intro-page-${index}`} {...pageA11y(active)} style={[styles.page, { width, height, backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm }]} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.top}>
            <PageDots count={count} step={index} scrollX={scrollX} width={width} on={colors.iris} off={colors.lineStrong} />
            <SkipLink color={colors.textSecondary} onPress={onSkip} />
          </View>
          <Text variant="title">{title}</Text>
          <Parallax index={index} width={width} scrollX={scrollX} factor={0.12}>
            {preview}
          </Parallax>
          <Parallax index={index} width={width} scrollX={scrollX} factor={0.3}>
            <View style={styles.pipRow}>
              <Pip mood={pip.mood} size={88} scarf={look.scarf} tail={look.scarf} shades={look.shades} wavePose={look.wavePose} />
              <View style={styles.flex}>
                <Pop active={active}>
                  <SpeechCard style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, marginBottom: space.xl }}>{says}</SpeechCard>
                </Pop>
              </View>
            </View>
          </Parallax>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(space.xl, insets.bottom + space.md) }]}>
        <View style={[styles.column, styles.footerRow]}>
          <IconButton icon="back" accessibilityLabel="Back" onPress={onBack} style={styles.back} />
          <Button label="Next" iconRight="arrowRight" onPress={onNext} style={styles.flex} />
        </View>
      </View>
    </View>
  );
}

type ReadyProps = PagerProps & { title: string; says: string; onBack: () => void; onStart: () => void; onInvite: () => void };

/** Page 6: Pip cheers, and the person heads to sign in. */
export function ReadyPage({ index, count, width, height, scrollX, active, title, says, onBack, onStart, onInvite }: ReadyProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pip = usePipMood(active, 'yay');
  return (
    <View testID={`intro-page-${index}`} {...pageA11y(active)} style={[styles.page, { width, height, backgroundColor: colors.tint.trip }]}>
      <ScrollView contentContainerStyle={styles.grow} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={[styles.sky, { paddingTop: insets.top + space.sm }]}>
          <View style={[styles.readyTop, { top: insets.top + space.sm }]}>
            <PageDots count={count} step={index} scrollX={scrollX} width={width} on={colors.ink} off={colors.lineStrong} />
            <IconButton icon="back" accessibilityLabel="Back" onPress={onBack} />
          </View>
          <Parallax index={index} width={width} scrollX={scrollX} factor={0.35}>
            <Pip mood={pip.mood} size={180} scarf={colors.iris} tail={colors.iris} shadow />
          </Parallax>
        </View>
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(space.xxl, insets.bottom + space.xl) }]}>
          <View style={styles.column}>
            <Text variant="title">{title}</Text>
            <Pop active={active}>
              <SpeechCard>{says}</SpeechCard>
            </Pop>
            <View style={styles.actions}>
              <Button label="Get started" onPress={onStart} />
              <Button label="I have an invite code" variant="ghost" size="md" onPress={onInvite} accessibilityHint="Sign in, then enter your code" />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const speechStyle = { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 6 };

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  grow: { flexGrow: 1 },
  flex: { flex: 1 },
  sky: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space.sm, gap: space.md },
  clouds: { position: 'absolute', left: 0, right: 0, height: 120 },
  skip: { position: 'absolute', right: space.sm },
  skipLink: { minHeight: MIN_TOUCH, paddingHorizontal: space.md, justifyContent: 'center' },
  hello: { paddingVertical: space.md, paddingHorizontal: space.s18, marginLeft: 120 },
  sheet: { borderTopLeftRadius: radius.sheetTop, borderTopRightRadius: radius.sheetTop, paddingTop: space.lg, paddingHorizontal: space.xl },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: space.s20 },
  copy: { gap: space.md },
  actions: { gap: space.sm },
  body: { paddingHorizontal: space.screenX, paddingBottom: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: -space.md },
  pipRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s10 },
  footer: { paddingHorizontal: space.screenX, paddingTop: space.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 56, height: 56, borderRadius: 28 },
  readyTop: { position: 'absolute', left: space.screenX, right: space.screenX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
