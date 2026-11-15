import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Switch, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { DateRangePicker } from '@/components/date-range-picker';
import { OptionCard } from '@/components/trip/option-card';
import { SheetHeader } from '@/components/trip/sheet-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { balanceNote, useSplit } from '@/lib/split';
import { deleteTrip, leaveTrip, removeMember, renameTrip, setShowWhoMarked, unlockTrip, updateTrip, useTrip } from '@/lib/trips';
import { radius, space, toTripColor, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="calloutStrong" accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>{children}</View>
    </View>
  );
}

type Range = { start: string; end: string };

export default function TripSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading, refresh } = useTrip(id, me);
  const split = useSplit(id, me);
  const refreshSplit = split.refresh;

  // null until the organiser types, so live updates to the name never overwrite their edit.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  // The member waiting for a "remove?" confirmation, and the one being removed right now.
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  // The switch's value while a change is saving; null shows the saved setting.
  const [showWho, setShowWho] = useState<boolean | null>(null);
  // The colour while it saves; null shows the saved one.
  const [color, setColor] = useState<TripColor | null>(null);
  // How dates are chosen, once the organiser picks a card; null follows the trip.
  const [datesMode, setDatesMode] = useState<'vote' | 'fixed' | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [savingDates, setSavingDates] = useState(false);

  const reload = useCallback(() => {
    refresh();
    refreshSplit();
  }, [refresh, refreshSplit]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useTripLive(id, reload);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (loading && !trip) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading settings" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen contentStyle={styles.content}>
        <SheetHeader title="Trip settings" onClose={close} />
        <Text variant="body" tone="secondary">
          This trip doesn&apos;t exist, or you&apos;re not a member of it.
        </Text>
      </Screen>
    );
  }

  const isOrganiser = trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const noteFor = (userId: string, name?: string) => balanceNote(split.balances.get(userId) ?? 0, trip.currency, name);
  const errorText = error ? (
    <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
      {error}
    </Text>
  ) : null;

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveTrip(trip.id, me!);
      router.dismissAll();
      router.replace('/');
    } catch {
      setError("Couldn't leave the trip. Check your connection and try again.");
      setConfirmLeave(false);
    } finally {
      setLeaving(false);
    }
  };

  // Organisers can't leave (nobody would be left to run the trip); they delete it instead.
  if (!isOrganiser) {
    const organiser = trip.members.find((m) => m.role === 'organiser')?.display_name ?? 'the organiser';
    const myNote = me ? noteFor(me) : null;
    return (
      <Screen contentStyle={styles.content}>
        <SheetHeader title="Trip settings" onClose={close} />
        <SpeechCard>Only {organiser} can change this trip.</SpeechCard>
        <Section title="Leave">
          <Text variant="caption" tone="secondary">
            Leaving removes your free days and votes. You can rejoin later with the invite code.
          </Text>
          {errorText}
          {confirmLeave ? (
            <View style={styles.confirm}>
              <Text variant="bodyStrong" tone="danger" accessibilityLiveRegion="polite">
                Leave &quot;{trip.name}&quot;?
              </Text>
              {myNote ? (
                <Text variant="caption" tone="secondary">
                  {myNote}
                </Text>
              ) : null}
              <Button label="Yes, leave trip" loading={leaving} color={colors.danger} onPress={leave} />
              <Button label="Stay" variant="ghost" onPress={() => setConfirmLeave(false)} />
            </View>
          ) : (
            <Button label="Leave trip" variant="outline" onPress={() => setConfirmLeave(true)} />
          )}
        </Section>
      </Screen>
    );
  }

  const name = draft ?? trip.name;
  const trimmed = name.trim();
  const dirty = trimmed !== trip.name;
  const savedFixed = trip.fixed_start && trip.fixed_end ? { start: trip.fixed_start, end: trip.fixed_end } : null;
  const mode = datesMode ?? (savedFixed ? 'fixed' : 'vote');
  const shownRange = range ?? savedFixed;

  const save = async () => {
    if (!trimmed) {
      setError('Give your trip a name first.');
      return;
    }
    setSaving(true);
    try {
      await renameTrip(trip.id, trimmed);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setError("Couldn't rename the trip. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const changeColor = async (c: TripColor) => {
    setColor(c);
    setError(null);
    try {
      await updateTrip(trip.id, { color: c });
      await refresh();
    } catch {
      setError("Couldn't change the colour. Check your connection and try again.");
    } finally {
      setColor(null);
    }
  };

  const saveDates = async (next: Range | null) => {
    setSavingDates(true);
    setError(null);
    try {
      await updateTrip(trip.id, { fixed_start: next?.start ?? null, fixed_end: next?.end ?? null });
      setRange(null);
      setDatesMode(null);
      await refresh();
    } catch {
      setError("Couldn't change the dates. Check your connection and try again.");
    } finally {
      setSavingDates(false);
    }
  };

  const pickVote = () => {
    setDatesMode('vote');
    setRange(null);
    if (savedFixed) saveDates(null);
  };

  const destroy = async () => {
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      router.dismissAll();
      router.replace('/');
    } catch {
      setError("Couldn't delete the trip. Check your connection and try again.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const unlock = async () => {
    setUnlocking(true);
    try {
      await unlockTrip(trip.id);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setError("Couldn't unlock the trip. Check your connection and try again.");
      setConfirmUnlock(false);
    } finally {
      setUnlocking(false);
    }
  };

  const remove = async (userId: string) => {
    setRemoving(userId);
    try {
      await removeMember(trip.id, userId);
      setConfirmRemove(null);
      await refresh();
    } catch {
      setError("Couldn't remove that person. Check your connection and try again.");
      setConfirmRemove(null);
    } finally {
      setRemoving(null);
    }
  };

  const toggleShowWho = async (show: boolean) => {
    setShowWho(show);
    setError(null);
    try {
      await setShowWhoMarked(trip.id, show);
      await refresh();
    } catch {
      setError("Couldn't change who can see marked days. Check your connection and try again.");
    } finally {
      setShowWho(null);
    }
  };

  const shownWho = showWho ?? trip.show_who_marked;

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title="Trip settings" onClose={close} />
      {errorText}

      <Section title="Trip">
        <Input
          label="Trip name"
          value={name}
          onChangeText={(t) => {
            setDraft(t);
            if (error) setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => dirty && save()}
          maxLength={60}
        />
        <Text variant="calloutStrong">Colour</Text>
        <ColorSwatches value={color ?? toTripColor(trip.color)} onChange={changeColor} />
        <Button label="Save name" loading={saving} onPress={save} />
      </Section>

      {trip.status === 'planning' ? (
        <Section title="Dates">
          <View accessibilityRole="radiogroup" style={styles.options}>
            <OptionCard
              icon="vote"
              area="vote"
              title="Let the group vote"
              sub="Everyone marks the days they're free"
              selected={mode === 'vote'}
              onPress={pickVote}
            />
            <OptionCard
              icon="plan"
              area="plan"
              title="I already know"
              sub="Set the dates yourself"
              selected={mode === 'fixed'}
              onPress={() => setDatesMode('fixed')}
            />
          </View>
          {mode === 'fixed' ? (
            <>
              <DateRangePicker value={shownRange} onChange={setRange} />
              {range ? <Button label="Save dates" size="md" loading={savingDates} onPress={() => saveDates(range)} /> : null}
            </>
          ) : null}
        </Section>
      ) : null}

      <Section title="Plan">
        {trip.status === 'locked' ? (
          <>
            <Text variant="caption" tone="secondary">
              Locked in by mistake, or plans changed? Unlocking clears the dates and place so everyone can mark days and vote again. Days, places and votes are kept.
            </Text>
            {confirmUnlock ? (
              <View style={styles.confirm}>
                <Text variant="bodyStrong" accessibilityLiveRegion="polite">
                  Unlock &quot;{trip.name}&quot; and re-plan?
                </Text>
                <Button label="Yes, unlock" loading={unlocking} onPress={unlock} />
                <Button label="Keep it locked" variant="ghost" onPress={() => setConfirmUnlock(false)} />
              </View>
            ) : (
              <Button label="Unlock and re-plan" variant="outline" onPress={() => setConfirmUnlock(true)} />
            )}
          </>
        ) : (
          <>
            <Text variant="caption" tone="secondary">
              Pick the dates and the place. Everyone sees the final plan and voting stops.
            </Text>
            <Button
              label="Lock in the plan"
              variant="outline"
              onPress={() => router.push({ pathname: '/trip/[id]/lock', params: { id: trip.id } })}
            />
          </>
        )}
      </Section>

      <Section title="Privacy">
        <View style={styles.row}>
          <Text variant="body" style={styles.flex}>
            Show who marked each day
          </Text>
          <Switch
            value={shownWho}
            onValueChange={toggleShowWho}
            disabled={showWho !== null}
            accessibilityLabel="Show who marked each day"
            trackColor={{ true: colors.iris, false: colors.lineStrong }}
          />
        </View>
        <Text variant="caption" tone="secondary">
          {shownWho
            ? 'Everyone can see whose days are whose.'
            : "Everyone sees only how many people are free each day, not who. Each person still sees their own days."}
        </Text>
      </Section>

      <Section title="People">
        <Text variant="caption" tone="secondary">
          Removing someone clears their free days and votes. Places they suggested stay.
        </Text>
        {trip.members.map((m, i) => {
          const isMe = m.user_id === me;
          const note = confirmRemove === m.user_id ? noteFor(m.user_id, m.display_name) : null;
          return (
            <View key={m.user_id} style={[styles.person, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={styles.row}>
                <Avatar name={m.display_name} url={m.avatar_url} color={m.avatar_color} size={40} />
                <Text variant="label" style={styles.flex} numberOfLines={1}>
                  {m.display_name}
                  {isMe ? ' (you)' : ''}
                </Text>
                {m.role === 'organiser' ? (
                  <Badge label="Organiser" />
                ) : confirmRemove === m.user_id ? null : (
                  <Button
                    label="Remove"
                    accessibilityLabel={`Remove ${m.display_name}`}
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      setConfirmRemove(m.user_id);
                      if (error) setError(null);
                    }}
                  />
                )}
              </View>
              {confirmRemove === m.user_id ? (
                <View style={styles.confirm}>
                  <Text variant="bodyStrong" tone="danger" accessibilityLiveRegion="polite">
                    Remove {m.display_name} from the trip?
                  </Text>
                  {note ? (
                    <Text variant="caption" tone="secondary">
                      {note}
                    </Text>
                  ) : null}
                  <Button
                    label={`Yes, remove ${m.display_name}`}
                    loading={removing === m.user_id}
                    color={colors.danger}
                    onPress={() => remove(m.user_id)}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => setConfirmRemove(null)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </Section>

      <Section title="Danger zone">
        <Text variant="caption" tone="secondary">
          You run this trip, so you can&apos;t leave it. Deleting removes the trip and everything in it for everyone: days, places, votes, plans, expenses and photos. This can&apos;t be undone.
        </Text>
        {confirmDelete ? (
          <View style={styles.confirm}>
            <Text variant="bodyStrong" tone="danger" accessibilityLiveRegion="polite">
              Delete &quot;{trip.name}&quot; for everyone?
            </Text>
            <Button label="Yes, delete forever" loading={deleting} color={colors.danger} onPress={destroy} />
            <Button label="Keep trip" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </View>
        ) : (
          <Button label="Delete trip" variant="outline" onPress={() => setConfirmDelete(true)} />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.s20 },
  section: { gap: space.sm },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg, gap: space.md },
  options: { gap: space.s10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  person: { gap: space.md, paddingVertical: space.s10 },
  confirm: { gap: space.sm },
});
