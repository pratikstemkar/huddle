import { Stack } from 'expo-router';

import { useTheme } from '@/theme/use-theme';

export const unstable_settings = { anchor: 'index' };

export default function HangoutLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="lock"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </Stack>
  );
}
