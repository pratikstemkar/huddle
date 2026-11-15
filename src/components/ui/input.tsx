import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

export type InputProps = TextInputProps & {
  label: string;
  error?: string | null;
  containerStyle?: ViewStyle;
};

/** A labelled text field. The label doubles as the accessible name. */
export function Input({ label, error, containerStyle, style, onFocus, onBlur, accessibilityLabel, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error
    ? { borderWidth: 2, borderColor: colors.danger, paddingHorizontal: 17 }
    : focused
      ? { borderWidth: 2, borderColor: colors.iris, paddingHorizontal: 17 }
      : { borderWidth: 1, borderColor: colors.lineStrong };
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text variant="calloutStrong">{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { backgroundColor: colors.card, color: colors.text }, border, style]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: { minHeight: 56, paddingHorizontal: space.s18, borderRadius: radius.lg, fontSize: 17 },
});
