import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { TourProvider } from '@/components/tour/tour';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { takeJoinAfterSignIn } from '@/lib/intro-seen';
import { takePendingInvite } from '@/lib/pending-invite';
import { useTheme } from '@/theme/use-theme';

export const unstable_settings = { anchor: '(home)' };

export default function AppLayout() {
  const { colors } = useTheme();
  const { session } = useAuth();
  useNotifications(session?.user.id);

  // This layout mounts once signed in. If they arrived through an invite link while signed out,
  // carry on to the join screen with the code filled in. "I have an invite code" on the intro opens it empty.
  useEffect(() => {
    Promise.all([takePendingInvite(), takeJoinAfterSignIn()]).then(([code, join]) => {
      if (code) router.push({ pathname: '/join', params: { code } });
      else if (join) router.push('/join');
    });
  }, []);

  return (
    <TourProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="new-trip" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="new-group" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="explore" />
        <Stack.Screen name="new-hangout" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="hangout/[id]" />
        <Stack.Screen name="join" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="delete-account" />
      </Stack>
    </TourProvider>
  );
}
