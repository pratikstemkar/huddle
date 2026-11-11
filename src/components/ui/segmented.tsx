import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.wrap, { backgroundColor: colors.cardMuted }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.item, on && { backgroundColor: colors.card }]}>
            <Text variant="label" tone={on ? 'primary' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  item: { flex: 1, minHeight: MIN_TOUCH - 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
