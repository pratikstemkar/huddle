import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { takePendingInvite } from '@/lib/pending-invite';
import { useTheme } from '@/theme/use-theme';

export const unstable_settings = { anchor: '(home)' };

export default function AppLayout() {
  const { colors } = useTheme();

  // This layout mounts once signed in. If they arrived through an invite link while signed out,
  // carry on to the join screen with the code filled in.
  useEffect(() => {
    takePendingInvite().then((code) => {
      if (code) router.push({ pathname: '/join', params: { code } });
    });
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(home)" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="new-trip" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.bg } }} />
      <Stack.Screen name="new-group" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.bg } }} />
      <Stack.Screen name="new-hangout" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.bg } }} />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="hangout/[id]" />
      <Stack.Screen name="join" />
      <Stack.Screen name="delete-account" />
    </Stack>
  );
}
