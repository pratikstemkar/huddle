import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Avatar } from '@/components/ui/avatar';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { addEventToCalendar } from '@/lib/calendar';
import { useGroupsLive } from '@/lib/groups';
import {
  answerHangout,
  answerProgress,
  bestSlotId,
  cancelHangout,
  closesLabel,
  myAnswer,
  parseMapsLink,
  slotLabel,
  tally,
  useHangout,
  type Answer,
  type HangoutDetail,
  type Slot,
} from '@/lib/hangouts';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const dow = new Intl.DateTimeFormat('en', { weekday: 'short' });
const monthDay = (d: Date) => d.getDate();

function openPlace(url: string | null) {
  // Only ever open a real Google Maps link, whatever the row says.
  const ok = url ? parseMapsLink(url) : null;
  if (ok) Linking.openURL(ok.url).catch(() => {});
}

function PlaceLink({ hangout }: { hangout: HangoutDetail }) {
  const { colors } = useTheme();
  if (!hangout.place_name) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${hangout.place_name}, open in Maps`}
      onPress={() => openPlace(hangout.place_url)}
      style={styles.place}>
      <Icon name="pin" size={18} />
      <Text variant="label" numberOfLines={1} style={styles.placeName}>
        {hangout.place_name}
      </Text>
      <Text variant="label" style={{ color: colors.irisText }}>
        Open in Maps
      </Text>
    </Pressable>
  );
}

function AnswerButtons({ slot, me, find, busy, onAnswer }: { slot: Slot; me: string | undefined; find: boolean; busy: boolean; onAnswer: (a: Answer | null) => void }) {
  const { colors } = useTheme();
  const mine = myAnswer(slot, me);
  const options: { value: Answer; label: string; icon: 'check' | 'maybe' | 'close'; bg: string; fg: string }[] = [
    { value: 'yes', label: find ? 'Works' : 'I’m in', icon: 'check', bg: colors.positive, fg: '#0B2E26' },
    ...(find ? [{ value: 'maybe' as const, label: 'If needed', icon: 'maybe' as const, bg: colors.beak, fg: colors.onBeak }] : []),
    { value: 'no', label: 'Can’t', icon: 'close', bg: colors.ink, fg: colors.onInk },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={`Your answer for ${slotLabel(slot.starts_at, slot.ends_at)}`} style={styles.answers}>
      {options.map((o) => {
        const on = mine === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            aria-checked={on}
            aria-disabled={busy}
            disabled={busy}
            onPress={() => onAnswer(on ? null : o.value)}
            style={[styles.answer, { backgroundColor: on ? o.bg : colors.bg }]}>
            <Icon name={o.icon} size={16} color={on ? o.fg : colors.textSecondary} strokeWidth={2.4} />
            <Text variant="calloutStrong" style={{ color: on ? o.fg : colors.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HangoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { hangout, loading, error, refresh } = useHangout(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useGroupsLive(!!me, refresh);

  const answer = async (slot: Slot, a: Answer | null) => {
    setBusy(slot.id);
    setActionError(null);
    try {
      await answerHangout(slot.id, a);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't save your answer.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!hangout) return;
    setActionError(null);
    try {
      await cancelHangout(hangout.id);
      router.back();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't cancel the hangout.");
    }
  };

  const top = (
    <View style={styles.top}>
      <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} />
    </View>
  );

  if (!hangout) {
    return (
      <Screen>
        <View style={styles.body}>
          {top}
          <View style={styles.center}>
            <Pip mood="hmm" size={96} />
            <Text variant="callout" tone="secondary" accessibilityLiveRegion="polite">
              {loading ? 'Loading the hangout' : (error ?? 'That hangout isn’t here, or you’re not in it.')}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  const organiser = hangout.created_by === me;
  const find = hangout.mode === 'find';
  const cancelled = hangout.status === 'cancelled';
  const locked = hangout.status === 'locked';
  const chosen = hangout.slots.find((s) => s.id === hangout.locked_slot_id) ?? null;
  const progress = answerProgress(hangout);
  const best = find && !locked ? bestSlotId(hangout.slots) : null;
  const closes = hangout.answers_close_at && !locked ? closesLabel(hangout.answers_close_at) : null;
  const byId = new Map(hangout.members.map((m) => [m.user_id, m]));
  const meta = [
    hangout.duration_min ? `About ${hangout.duration_min / 60} ${hangout.duration_min === 60 ? 'hr' : 'hrs'}` : null,
    find && !locked ? `${progress.answered} of ${progress.asked} answered` : `${hangout.members.length} invited`,
    closes ? `closes ${closes}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const addToCalendar = (slot: Slot) =>
    addEventToCalendar({ id: hangout.id, name: hangout.name, start: new Date(slot.starts_at), end: slot.ends_at ? new Date(slot.ends_at) : null, place: hangout.place_name }).catch(() => {});

  const header = (
    <View style={styles.header}>
      <View style={styles.who}>
        <Avatar name={hangout.organiser} size={24} color={byId.get(hangout.created_by ?? '')?.avatar_color} />
        <Text variant="callout" tone="secondary">
          {organiser ? 'You invited' : `${hangout.organiser} invited`} {hangout.group_name ?? 'you'}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header" numberOfLines={3}>
        {hangout.name}
      </Text>
      <Text variant="callout" tone="secondary">
        {meta}
      </Text>
      <PlaceLink hangout={hangout} />
    </View>
  );

  if (cancelled) {
    return (
      <Screen>
        <View style={styles.body}>
          {top}
          {header}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text variant="cardTitle">Cancelled</Text>
            <Text variant="callout" tone="secondary">
              {organiser ? 'You cancelled this hangout.' : `${hangout.organiser} cancelled this hangout.`}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  // A locked time, or an "I'll pick it" hangout: one time, who's in.
  const single = locked ? chosen : !find ? (hangout.slots[0] ?? null) : null;
  if (single) {
    // The organiser is in unless they said otherwise; everyone else is in once they've said yes or maybe.
    const goingIds = new Set(single.answers.filter((a) => a.answer !== 'no').map((a) => a.user_id));
    if (hangout.created_by && !single.answers.some((a) => a.user_id === hangout.created_by && a.answer === 'no')) goingIds.add(hangout.created_by);
    const going = hangout.members.filter((m) => goingIds.has(m.user_id));
    return (
      <Screen
        footer={
          <View style={styles.footer}>
            {organiser && !locked ? (
              confirmCancel ? (
                <View style={styles.confirm}>
                  <Button label="Keep it" variant="outline" size="sm" style={styles.confirmButton} onPress={() => setConfirmCancel(false)} />
                  <Button label="Cancel for everyone" variant="ink" size="sm" style={styles.confirmButton} onPress={cancel} />
                </View>
              ) : (
                <Button label="Cancel hangout" variant="ghost" size="sm" onPress={() => setConfirmCancel(true)} />
              )
            ) : null}
          </View>
        }>
        <View style={styles.body}>
          {top}
          {header}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={styles.row}>
              <View style={[styles.dayBox, { backgroundColor: colors.bg }]}>
                <Text variant="badge" tone="secondary">
                  {dow.format(new Date(single.starts_at)).toUpperCase()}
                </Text>
                <Text variant="cardTitle">{monthDay(new Date(single.starts_at))}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="cardTitle">{slotLabel(single.starts_at, single.ends_at).split(' · ')[1]}</Text>
                <Text variant="caption" tone="secondary">
                  {locked ? 'Locked in' : 'Set by the organiser'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <AvatarStack size={28} overlap={8} ring={colors.card} max={5} people={going.map((p) => ({ name: p.display_name, url: p.avatar_url, color: p.avatar_color }))} />
              <Text variant="callout" tone="secondary" style={styles.flex}>
                {going.length} {going.length === 1 ? 'person is' : 'people are'} in
              </Text>
            </View>
            {!locked ? <AnswerButtons slot={single} me={me} find={false} busy={busy === single.id} onAnswer={(a) => answer(single, a)} /> : null}
            <Button label="Add to calendar" icon="plan" variant="secondary" size="sm" onPress={() => addToCalendar(single)} />
          </View>
          {actionError ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {actionError}
            </Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        organiser ? (
          <View style={styles.footer}>
            <Button label="Lock a time" icon="lock" onPress={() => router.push({ pathname: '/hangout/[id]/lock', params: { id: hangout.id } })} />
            {confirmCancel ? (
              <View style={styles.confirm}>
                <Button label="Keep it" variant="outline" size="sm" style={styles.confirmButton} onPress={() => setConfirmCancel(false)} />
                <Button label="Cancel for everyone" variant="ink" size="sm" style={styles.confirmButton} onPress={cancel} />
              </View>
            ) : (
              <Button label="Cancel hangout" variant="ghost" size="sm" onPress={() => setConfirmCancel(true)} />
            )}
          </View>
        ) : (
          <Text variant="caption" tone="secondary" style={styles.center}>
            Your answers are saved as you tap.
          </Text>
        )
      }>
      <View style={styles.body}>
        {top}
        {header}
        <View style={styles.slots}>
          {hangout.slots.map((slot) => {
            const t = tally(slot);
            const people = slot.answers.filter((a) => a.answer === 'yes').map((a) => byId.get(a.user_id)).filter((p): p is NonNullable<typeof p> => !!p);
            const isBest = slot.id === best;
            const d = new Date(slot.starts_at);
            return (
              <View key={slot.id} style={[styles.card, { backgroundColor: colors.card, borderColor: isBest ? colors.iris : colors.line, borderWidth: isBest ? 2 : 1 }]}>
                <View style={styles.row}>
                  <View style={[styles.dayBox, { backgroundColor: colors.bg }]}>
                    <Text variant="badge" tone="secondary">
                      {dow.format(d).toUpperCase()}
                    </Text>
                    <Text variant="cardTitle">{monthDay(d)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.row}>
                      <Text variant="label">{slotLabel(slot.starts_at, slot.ends_at).split(' · ')[1]}</Text>
                      {isBest ? <Badge label="Best so far" tone="beak" /> : null}
                    </View>
                    <View style={styles.row}>
                      <AvatarStack size={22} overlap={6} ring={colors.card} max={4} people={people.map((p) => ({ name: p.display_name, url: p.avatar_url, color: p.avatar_color }))} />
                      <Text variant="caption" tone="secondary">
                        {t.yes} can make it{t.maybe ? ` · ${t.maybe} if needed` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
                <AnswerButtons slot={slot} me={me} find busy={busy === slot.id} onAnswer={(a) => answer(slot, a)} />
              </View>
            );
          })}
        </View>
        {actionError ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {actionError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, textAlign: 'center' },
  header: { gap: space.xs },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  place: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.s6 },
  placeName: { flexShrink: 1 },
  slots: { gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.s10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  dayBox: { width: 52, height: 52, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  answers: { flexDirection: 'row', gap: space.s6 },
  answer: { flex: 1, height: 44, borderRadius: radius.tile, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s6 },
  footer: { gap: space.sm },
  confirm: { flexDirection: 'row', gap: space.sm },
  confirmButton: { flex: 1 },
});
