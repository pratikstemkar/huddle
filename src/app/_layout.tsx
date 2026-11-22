import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ConfirmProvider } from '@/components/ui/confirm-sheet';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { IntroSeenProvider, useIntroSeen } from '@/lib/intro-seen';
import { configureNotifications } from '@/lib/notifications';
import { useUpdateCheck } from '@/lib/use-update-check';
import { ThemePreferenceProvider, useThemePreference } from '@/theme/theme-preference';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();
configureNotifications();

function RootStack() {
  const { session, loading } = useAuth();
  const { scheme, colors } = useTheme();
  const { loaded: themeLoaded } = useThemePreference();
  const { seen: introSeen, loaded: introLoaded, markSeen } = useIntroSeen();
  const [fontsLoaded] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  const ready = fontsLoaded && !loading && themeLoaded && introLoaded;

  // Anyone who has signed in on this device knows the app: no intro after they sign out.
  useEffect(() => {
    if (session && introLoaded && !introSeen) markSeen();
  }, [session, introLoaded, introSeen, markSeen]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.iris, border: colors.line },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {/* Explicit targets: the "first available screen" fallback would pick the public privacy page. */}
        <Stack.Protected guard={!!session} redirectTo={introSeen ? '/sign-in' : '/intro'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        {/* First open only: Pip's intro, then sign in. */}
        <Stack.Protected guard={!session && !introSeen} redirectTo={session ? '/' : '/sign-in'}>
          <Stack.Screen name="intro" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session} redirectTo="/">
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        </Stack.Protected>
        {/* Invite links work signed in or out; signed out, the code is kept through sign-in. */}
        <Stack.Screen name="invite/[code]" />
        {/* Public too: the app stores link here. */}
        <Stack.Screen name="privacy" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useUpdateCheck();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemePreferenceProvider>
        <IntroSeenProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                <RootStack />
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </IntroSeenProvider>
      </ThemePreferenceProvider>
    </GestureHandlerRootView>
  );
}
