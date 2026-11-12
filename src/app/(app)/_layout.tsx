import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { takePendingInvite } from '@/lib/pending-invite';

import { useTheme } from '@/theme/use-theme';

export default function AppLayout() {
  const { colors } = useTheme();

  // This layout mounts once signed in. If they arrived through an invite link while signed out,
  // carry on to the join sheet with the code filled in.
  useEffect(() => {
    takePendingInvite().then((code) => {
      if (code) router.push({ pathname: '/join', params: { code } });
    });
  }, []);

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
        name="trip/[id]/settings"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Stack.Screen
        name="trip/[id]/lock"
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
        name="profile"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
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
