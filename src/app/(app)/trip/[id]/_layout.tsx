import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { TripIdProvider } from '@/components/nav/trip-id';
import { useConfirm } from '@/components/ui/confirm-sheet';
import { askForPushOnce } from '@/lib/notifications';
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

/** Opening a trip (usually right after starting or joining one) is when a ping starts to be useful. */
const ASK_DELAY_MS = 1200;

export default function TripLayout() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const confirm = useConfirm();

  useEffect(() => {
    const t = setTimeout(() => {
      askForPushOnce(() =>
        confirm({
          title: 'Get a ping when the plan moves?',
          message: "Huddle can tell you when you're invited, when a trip is locked, and when the group is waiting on you.",
          confirmLabel: 'Turn on',
          cancelLabel: 'Not now',
        }),
      );
    }, ASK_DELAY_MS);
    return () => clearTimeout(t);
  }, [confirm]);

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
