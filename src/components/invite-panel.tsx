import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Pip } from '@/components/pip/pip';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { nightsBetween, today as todayDay } from '@/lib/dates';
import { useTripLive } from '@/lib/realtime';
import { inviteLink, inviteMessage, useTrip, type TripMember } from '@/lib/trips';
import { fonts, radius, space, toTripColor, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

const COPIED_MS = 1800;
const JUST_JOINED_MS = 10 * 60 * 1000;

/** The member's local calendar day for a timestamp. */
function localDay(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Just joined" within ten minutes, then "Joined today", "Joined yesterday" or "Joined N days ago". */
export function joinedStatus(joinedAt: string, now: Date = new Date()): { text: string; fresh: boolean } {
  const at = new Date(joinedAt).getTime();
  if (Number.isFinite(at) && now.getTime() - at < JUST_JOINED_MS) return { text: 'Just joined', fresh: true };
  const days = Math.max(0, nightsBetween(localDay(joinedAt), todayDay()));
  if (days === 0) return { text: 'Joined today', fresh: false };
  if (days === 1) return { text: 'Joined yesterday', fresh: false };
  return { text: `Joined ${days} days ago`, fresh: false };
}

/** A label that reads "Copied" for a moment after `flash()`. */
function useFlash() {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = () => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), COPIED_MS);
  };
  return [on, flash] as const;
}

function MemberRow({ member, me, last }: { member: TripMember; me: boolean; last: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const status = member.role === 'organiser' ? null : joinedStatus(member.joined_at);
  const name = me ? `${member.display_name} (you)` : member.display_name;
  return (
    <Animated.View
      entering={status?.fresh && !reduced ? ZoomIn.springify().damping(12) : undefined}
      accessible
      accessibilityLabel={`${name}, ${status ? status.text : 'Organiser'}`}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      <Avatar name={member.display_name} url={member.avatar_url} color={member.avatar_color} size={40} />
      <Text variant="label" numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      {status ? (
        <Text variant="caption" tone={status.fresh ? 'positive' : 'secondary'} style={status.fresh && styles.fresh}>
          {status.text}
        </Text>
      ) : (
        <Badge label="Organiser" />
      )}
    </Animated.View>
  );
}

/** The invite code, copy and share buttons, and who has joined so far (live). */
export function InvitePanel({ tripId }: { tripId: string }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const myId = session?.user.id;
  const { trip, loading, error, refresh } = useTrip(tripId, myId);
  const [copied, flashCopied] = useFlash();
  const [shareCopied, flashShareCopied] = useFlash();

  useEffect(() => {
    refresh();
  }, [refresh]);
  useTripLive(tripId, refresh, ['trip_members', 'trips']);

  if (!trip) {
    return (
      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color={colors.iris} accessibilityLabel="Loading the invite" />
        ) : (
          <Text variant="body" tone={error ? 'danger' : 'secondary'} accessibilityLiveRegion="polite" style={styles.centerText}>
            {error ?? "This trip isn't available any more."}
          </Text>
        )}
      </View>
    );
  }

  const code = trip.invite_code;
  const letters = code.toUpperCase().split('');
  const half = Math.ceil(letters.length / 2);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(inviteLink(code));
      flashCopied();
    } catch {}
  };

  const share = async () => {
    const message = inviteMessage(trip.name, code);
    // Browsers without the Web Share API can't open a share sheet; copy the message instead.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      try {
        await Clipboard.setStringAsync(message);
        flashShareCopied();
      } catch {}
      return;
    }
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <View style={styles.root}>
      <View style={[styles.top, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Pip mood="hello" size={96} scarf={tripColors[toTripColor(trip.color)]} />
        <View style={styles.titles}>
          <Text variant="titleSm" style={styles.centerText}>
            Get the gang in
          </Text>
          <Text variant="callout" tone="secondary" style={styles.centerText}>
            Anyone with the code can join {trip.name}.
          </Text>
        </View>
        <View accessible accessibilityLabel={`Invite code ${code.split('').join(' ')}`} style={styles.code}>
          {letters.map((ch, i) => (
            <View key={i} style={[styles.letter, { backgroundColor: i < half ? colors.tint.vote : colors.tint.trip }]}>
              <Text selectable style={[styles.letterText, { color: colors.text }]}>
                {ch}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <Button label={copied ? 'Copied' : 'Copy link'} variant="outline" size="md" icon="copy" onPress={copy} style={styles.action} />
          <Button label={shareCopied ? 'Copied' : 'Share'} size="md" icon="share" onPress={share} style={styles.action} />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="heading">In the huddle · {trip.members.length}</Text>
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {trip.members.map((m, i) => (
            <MemberRow key={m.user_id} member={m} me={m.user_id === myId} last={i === trip.members.length - 1} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.s18 },
  center: { minHeight: 200, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  centerText: { textAlign: 'center' },
  top: { borderWidth: 1, borderRadius: radius.xl, padding: space.s20, gap: space.s14, alignItems: 'center' },
  titles: { gap: space.xs, alignItems: 'center' },
  code: { flexDirection: 'row', gap: space.s6, alignSelf: 'stretch', justifyContent: 'center' },
  letter: { flex: 1, maxWidth: 44, height: 56, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  actions: { flexDirection: 'row', gap: space.s10, alignSelf: 'stretch' },
  action: { flex: 1, paddingHorizontal: space.sm },
  section: { gap: space.s10 },
  list: { borderWidth: 1, borderRadius: radius.card, paddingVertical: space.xs, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.s10 },
  name: { flex: 1 },
  fresh: { fontWeight: '600' },
});
