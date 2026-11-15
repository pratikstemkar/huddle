import * as Haptics from 'expo-haptics';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MAX_CONTENT_WIDTH, NAV_BOTTOM, NAV_HEIGHT, NAV_INSET, radius, shadow, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type PillTab = { name: string; label: string; icon: IconName };

type TabItemProps = Omit<TabTriggerSlotProps, 'ref'> & { label: string; icon: IconName };

function TabItem({ label, icon, isFocused, onPress, ...rest }: TabItemProps) {
  const { colors } = useTheme();
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
      style={[styles.item, isFocused && { backgroundColor: colors.tint.vote }]}>
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
          ]}>
          {tabs.map((t) => (
            <TabTrigger key={t.name} name={t.name} asChild>
              <TabItem label={t.label} icon={t.icon} />
            </TabTrigger>
          ))}
        </View>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: NAV_INSET, flexDirection: 'row', alignItems: 'center', gap: space.navGap },
  pill: { flex: 1, height: NAV_HEIGHT, padding: 4, borderWidth: 1, borderRadius: radius.nav, flexDirection: 'row' },
  item: { flex: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
});
