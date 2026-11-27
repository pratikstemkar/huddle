import { Stack, useLocalSearchParams } from 'expo-router';

import { TripIdProvider } from '@/components/nav/trip-id';
import { useTour } from '@/components/tour/tour';
import { useAskForPush } from '@/components/use-ask-for-push';
import { useTheme } from '@/theme/use-theme';

const SHEETS: { name: string; detents: number[] }[] = [
  { name: 'suggest', detents: [0.9, 1] },
  { name: 'settings', detents: [0.75, 1] },
  { name: 'lock', detents: [0.9, 1] },
  { name: 'invite', detents: [0.9, 1] },
  { name: 'invite-people', detents: [0.9, 1] },
  { name: 'plan-item', detents: [0.75, 1] },
  { name: 'expense', detents: [0.9, 1] },
  { name: 'settle', detents: [0.75, 1] },
];

const FULL_SCREEN: { name: string; presentation: 'fullScreenModal' | 'card' }[] = [
  { name: 'locked', presentation: 'fullScreenModal' },
  { name: 'photo/[photoId]', presentation: 'fullScreenModal' },
];

export const unstable_settings = { anchor: '(tabs)' };

export default function TripLayout() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Opening a trip (usually right after starting or joining one) is when a ping starts to be useful.
  // The first time, the trip tour goes first so the ask doesn't land on top of it.
  const tour = useTour();
  useAskForPush(tour.seen?.trip === true && !tour.active);

  return (
    <TripIdProvider id={id}>
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
    </TripIdProvider>
  );
}
