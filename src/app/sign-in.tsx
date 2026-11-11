import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { PostcardStack } from '@/components/postcard-stack';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { DEV_USERS, devAuthEnabled } from '@/lib/dev-auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

export default function SignIn() {
  const { signInWithGoogle, signInWithApple, signInAsDevUser } = useAuth();
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const enter = (delay: number) => (reduced ? undefined : FadeInUp.delay(delay).springify().damping(16));

  return (
    <Screen
      footer={
        <View style={{ gap: space.md }}>
          {error ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Continue with Google"
            variant="secondary"
            loading={busy === 'google'}
            icon={<Text variant="heading" style={{ color: '#4285F4' }}>G</Text>}
            onPress={() => run('google', signInWithGoogle)}
          />

          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radius.pill}
              style={{ height: MIN_TOUCH + 4 }}
              onPress={() => run('apple', signInWithApple)}
            />
          ) : null}

          {devAuthEnabled ? (
            <View style={[styles.dev, { borderColor: colors.line }]}>
              <Text variant="caption" tone="secondary">
                Developer sign-in (local Supabase only)
              </Text>
              <View style={styles.devRow}>
                {DEV_USERS.map((u) => (
                  <Pressable
                    key={u.email}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign in as ${u.name}`}
                    onPress={() => run(u.email, () => signInAsDevUser(u.email))}
                    style={({ pressed }) => [
                      styles.devChip,
                      { backgroundColor: colors.card, borderColor: colors.line, opacity: pressed || busy === u.email ? 0.6 : 1 },
                    ]}>
                    <View style={[styles.dot, { backgroundColor: u.color }]} />
                    <Text variant="label">{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      }>
      <Text variant="heading" tone="accent" accessibilityRole="text">
        huddle
      </Text>
      <PostcardStack />

      <Animated.View entering={enter(450)} style={{ gap: space.md, marginTop: space.lg }}>
        <Text variant="hero">Plan the trip, not the group chat.</Text>
        <Text variant="body" tone="secondary">
          Mark when you’re free, vote on where to go, and lock it in together.
        </Text>
      </Animated.View>

      {!isSupabaseConfigured ? (
        <View style={[styles.warn, { backgroundColor: colors.cardMuted, borderColor: colors.line }]}>
          <Text variant="label">Supabase isn’t set up yet</Text>
          <Text variant="caption" tone="secondary">
            Copy .env.example to .env.local and fill in your Supabase URL and anon key, then restart Expo.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dev: { borderTopWidth: 1, paddingTop: space.md, marginTop: space.xs, gap: space.sm },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  devChip: {
    minHeight: MIN_TOUCH - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  warn: { marginTop: space.xl, padding: space.lg, borderRadius: radius.md, borderWidth: 1, gap: space.xs },
});
