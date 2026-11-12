import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { savePendingInvite, takePendingInvite } from '@/lib/pending-invite';
import { invitePreview, type InvitePreview } from '@/lib/trips';
import { radius, space, tripColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Where shared invite links land (`/invite/<code>`), signed in or not.
 * Signed in: straight on to the join sheet. Signed out: show the trip, keep the code through sign-in.
 */
export default function Invite() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.trim() : '';

  if (session) return <Redirect href={code ? { pathname: '/join', params: { code } } : '/'} />;
  return <SignedOutInvite code={code} />;
}

function SignedOutInvite({ code }: { code: string }) {
  const { colors } = useTheme();
  // 'offline': the preview couldn't load; they can still sign in and the join sheet reports any real problem.
  const [state, setState] = useState<InvitePreview | 'loading' | 'unknown' | 'offline'>(code ? 'loading' : 'unknown');

  useEffect(() => {
    if (!code) return;
    let live = true;
    savePendingInvite(code)
      .then(() => invitePreview(code))
      .then(async (p) => {
        if (!p) await takePendingInvite(); // nothing to join; don't send them to a failing join sheet later
        if (live) setState(p ?? 'unknown');
      })
      .catch(() => live && setState('offline'));
    return () => {
      live = false;
    };
  }, [code]);

  const loading = state === 'loading';
  const unknown = state === 'unknown';
  const preview = typeof state === 'object' ? state : null;

  return (
    <Screen
      footer={
        unknown ? (
          <Button label="Go to Huddle" variant="secondary" onPress={() => router.replace('/sign-in')} />
        ) : (
          <Button label="Sign in to join" onPress={() => router.replace('/sign-in')} />
        )
      }>
      <Text variant="heading" tone="accent">
        huddle
      </Text>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading the invite" />
        ) : unknown ? (
          <>
            <Text variant="title">This invite doesn’t work</Text>
            <Text variant="body" tone="secondary">
              The link may be mistyped, or the trip was deleted. Ask your friend to send it again.
            </Text>
          </>
        ) : (
          <>
            <Text variant="body" tone="secondary">
              You’re invited to
            </Text>
            {preview ? (
              <View style={[styles.card, { backgroundColor: tripColors[preview.color] ?? tripColors.sunset }]}>
                <Text variant="title" tone="onColor" numberOfLines={2}>
                  {preview.name}
                </Text>
                <Text variant="caption" tone="onColor">
                  {preview.members === 1 ? '1 person is going' : `${preview.members} people are going`}
                </Text>
              </View>
            ) : (
              <Text variant="title">a trip on Huddle</Text>
            )}
            <Text variant="body" tone="secondary">
              Sign in and you’ll go straight to joining it. Mark when you’re free and vote on where to go.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.md },
  card: { borderRadius: radius.lg, padding: space.xl, gap: space.xs, minHeight: 140, justifyContent: 'flex-end' },
});
