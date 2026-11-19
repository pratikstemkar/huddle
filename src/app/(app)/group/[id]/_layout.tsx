import { Stack } from 'expo-router';

import { useTheme } from '@/theme/use-theme';

const SHEETS: { name: string; detents: number[] }[] = [
  { name: 'edit', detents: [0.6, 1] },
  { name: 'add', detents: [0.9, 1] },
];

export const unstable_settings = { anchor: 'index' };

export default function GroupLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
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
    </Stack>
  );
}
