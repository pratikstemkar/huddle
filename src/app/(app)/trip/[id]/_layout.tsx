import { Stack } from 'expo-router';

import { useTheme } from '@/theme/use-theme';

const SHEETS: { name: string; detents: number[] }[] = [
  { name: 'suggest', detents: [0.9, 1] },
  { name: 'settings', detents: [0.75, 1] },
  { name: 'lock', detents: [0.9, 1] },
];

const FULL_SCREEN: { name: string; presentation: 'fullScreenModal' | 'card' }[] = [];

export const unstable_settings = { anchor: '(tabs)' };

export default function TripLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="days" />
      <Stack.Screen name="places" />
      {SHEETS.map((s) => (
        <Stack.Screen
          key={s.name}
          name={s.name}
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: s.detents,
            sheetCornerRadius: 28,
            sheetGrabberVisible: true,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      ))}
      {FULL_SCREEN.map((s) => (
        <Stack.Screen key={s.name} name={s.name} options={{ presentation: s.presentation, contentStyle: { backgroundColor: colors.bg } }} />
      ))}
    </Stack>
  );
}
