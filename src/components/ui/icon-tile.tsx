import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, type TintArea } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon, type IconName } from './icon';

type Props = {
  /** The trip area whose tint fills the tile. */
  area: TintArea;
  icon?: IconName;
  /** `lg` is the 64pt tile on the trips list. */
  size?: 'md' | 'lg';
  /** Overrides the tint, e.g. a trip colour's own tint. */
  background?: string;
  /** Replaces the icon, e.g. a day count. */
  children?: ReactNode;
  style?: ViewStyle;
};

/** A tinted square holding an area icon. Decorative. */
export function IconTile({ area, icon, size = 'md', background, children, style }: Props) {
  const { colors } = useTheme();
  const lg = size === 'lg';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[lg ? styles.lg : styles.md, { backgroundColor: background ?? colors.tint[area] }, style]}>
      {children ?? (icon ? <Icon name={icon} size={lg ? 28 : 22} color={colors.text} /> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  md: { width: 40, height: 40, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  lg: { width: 64, height: 64, borderRadius: radius.tileLg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
