import { Stack } from 'expo-router';

import { useTheme } from '@/theme/use-theme';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="trip/[id]/index" />
      <Stack.Screen name="trip/[id]/days" />
      <Stack.Screen name="trip/[id]/places" />
      <Stack.Screen
        name="trip/[id]/suggest"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Stack.Screen
        name="join"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Stack.Screen
        name="new-trip"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </Stack>
  );
}
