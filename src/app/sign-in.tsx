import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Wordmark } from '@/components/ui/wordmark';
import { WelcomeScene } from '@/components/welcome-scene';
import { useAuth } from '@/lib/auth';
import { DEV_USERS, devAuthEnabled } from '@/lib/dev-auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function SignIn() {
  const { signInWithGoogle, signInWithApple, signInAsDevUser } = useAuth();
  const { colors, scheme } = useTheme();
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

  return (
    <WelcomeScene>
      <View style={{ gap: space.s10 }}>
        <Wordmark size={48} style={{ lineHeight: 50 }} />
        <Text variant="bodyLg" tone="secondary">
          Plan trips with your people. Suggest places, vote, split costs and keep every photo in one spot.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={28}
            style={{ height: 56 }}
            onPress={() => run('apple', signInWithApple)}
          />
        ) : null}
        <Button label="Continue with Google" variant="outline" icon="google" loading={busy === 'google'} onPress={() => run('google', signInWithGoogle)} />
      </View>

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={styles.center}>
          {error}
        </Text>
      ) : null}

      {!isSupabaseConfigured ? (
        <View style={[styles.warn, { backgroundColor: colors.tint.plan }]}>
          <Text variant="label">Supabase isn’t set up yet</Text>
          <Text variant="caption" tone="secondary">
            Copy .env.example to .env.local and fill in your Supabase URL and anon key, then restart Expo.
          </Text>
        </View>
      ) : null}

      {devAuthEnabled ? (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="secondary">
            Developer sign-in (local Supabase only)
          </Text>
          <View style={styles.devRow}>
            {DEV_USERS.map((u) => (
              <Pressable
                key={u.email}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${u.name}`}
                aria-busy={busy === u.email}
                onPress={() => run(u.email, () => signInAsDevUser(u.email))}
                style={({ pressed }) => [
                  styles.devChip,
                  { backgroundColor: colors.card, borderColor: colors.line, opacity: pressed || busy === u.email ? 0.6 : 1 },
                ]}>
                <View style={[styles.dot, { backgroundColor: u.color }]} />
                <Text variant="calloutStrong">{u.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text variant="badge" tone="secondary" style={[styles.center, styles.footer]}>
        By continuing you agree to the{' '}
        <Text variant="badge" tone="iris" accessibilityRole="link" onPress={() => router.push('/privacy')}>
          privacy policy
        </Text>
        .
      </Text>
    </WelcomeScene>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  footer: { lineHeight: 18, fontWeight: '400' },
  warn: { padding: space.lg, borderRadius: radius.lg, gap: space.xs },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  devChip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
