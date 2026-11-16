import * as Haptics from 'expo-haptics';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MAX_CONTENT_WIDTH, NAV_BOTTOM, NAV_HEIGHT, NAV_INSET, radius, shadow, space } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

export type PillTab = { name: string; label: string; icon: IconName };

type TabItemProps = Omit<TabTriggerSlotProps, 'ref'> & {
  label: string;
  icon: IconName;
  index: number;
  /** Tells the bar which tab is focused so the highlight can slide to it. */
  onFocused: (index: number) => void;
};

function TabItem({ label, icon, index, onFocused, isFocused, onPress, ...rest }: TabItemProps) {
  const { colors } = useTheme();
  useEffect(() => {
    if (isFocused) onFocused(index);
  }, [isFocused, index, onFocused]);
  const tint = isFocused ? colors.irisText : colors.textSecondary;
  return (
    <Pressable
      {...rest}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      onPress={(e) => {
        if (!isFocused && Platform.OS !== 'web') Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={styles.item}>
      <Icon name={icon} size={22} color={tint} />
      <Text variant="tab" style={{ color: tint }} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

type Props = {
  tabs: PillTab[];
  /** The round button after the pill, usually `<PipButton />`. */
  trailing?: ReactNode;
  accessibilityLabel: string;
};

/** The floating glass tab bar. Render it inside expo-router/ui `<Tabs>`; triggers match tabs by name. */
export function PillTabBar({ tabs, trailing, accessibilityLabel }: Props) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const reduced = useReducedMotion();
  const [pillWidth, setPillWidth] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const x = useSharedValue(0);
  const slotWidth = pillWidth > 0 ? (pillWidth - PILL_PAD * 2 - 2) / tabs.length : 0;

  useEffect(() => {
    if (slotWidth === 0) return;
    const target = PILL_PAD + focusedIndex * slotWidth;
    // First measurement jumps; later changes glide without overshoot, so quick taps reverse cleanly.
    if (reduced || x.get() === 0) x.set(target);
    else x.set(withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) }));
  }, [focusedIndex, slotWidth, reduced, x]);

  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  if (keyboardOpen) return null;
  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom: NAV_BOTTOM + insets.bottom }]}>
      <View pointerEvents="box-none" style={styles.bar}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.pill,
            { backgroundColor: colors.navGlass, borderColor: colors.line, boxShadow: shadow[scheme].nav },
            Platform.OS === 'web' && ({ backdropFilter: 'blur(18px)' } as object),
          ]}
          onLayout={(e: LayoutChangeEvent) => setPillWidth(e.nativeEvent.layout.width)}>
          {slotWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              testID="tab-highlight"
              style={[styles.highlight, { width: slotWidth, backgroundColor: colors.tint.vote }, highlight]}
            />
          )}
          {tabs.map((t, i) => (
            <TabTrigger key={t.name} name={t.name} asChild>
              <TabItem label={t.label} icon={t.icon} index={i} onFocused={setFocusedIndex} />
            </TabTrigger>
          ))}
        </View>
        {trailing}
      </View>
    </View>
  );
}

const PILL_PAD = 4;

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: NAV_INSET, flexDirection: 'row', alignItems: 'center', gap: space.navGap },
  pill: { flex: 1, height: NAV_HEIGHT, padding: 4, borderWidth: 1, borderRadius: radius.nav, flexDirection: 'row' },
  highlight: { position: 'absolute', top: PILL_PAD, bottom: PILL_PAD, left: 0, borderRadius: radius.xl },
  item: { flex: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
});
