import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayTimeChips, SlotGrid } from '@/components/hangout/slot-picker';
import { MemberGrid } from '@/components/groups/member-grid';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useGroup, useGroups } from '@/lib/groups';
import {
  createHangout,
  DURATIONS,
  gridDays,
  hangoutName,
  KINDS,
  MAX_HANGOUT_NAME,
  parseMapsLink,
  picksToSlots,
  kindName,
  closesLabel,
  type HangoutKind,
  type HangoutMode,
  type PartOfDay,
  type SlotPick,
  pickKey,
} from '@/lib/hangouts';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A new hangout in two steps: what and who, then when. */
export default function NewHangout() {
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { groups, loading, refresh: refreshGroups } = useGroups(me);

  const [step, setStep] = useState<'details' | 'times'>('details');
  const [kind, setKind] = useState<HangoutKind>('dinner');
  const [name, setName] = useState('');
  const [placeText, setPlaceText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [off, setOff] = useState<Record<string, string[]>>({});
  const [changing, setChanging] = useState(false);
  const [mode, setMode] = useState<HangoutMode>('find');

  const [week, setWeek] = useState(0);
  const [picks, setPicks] = useState<SlotPick[]>([]);
  const [duration, setDuration] = useState('2h');
  const [exactOpen, setExactOpen] = useState(false);
  const [exactDay, setExactDay] = useState<Date | null>(null);
  const [exactTime, setExactTime] = useState<{ hour: number; minute: number } | null>(null);
  const [closes] = useState(() => new Date(Date.now() + DAY_MS));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshGroups();
    }, [refreshGroups]),
  );

  const groupId = picked ?? (groups.some((g) => g.id === groupParam) ? (groupParam as string) : (groups[0]?.id ?? null));
  const { group, refresh: refreshGroup } = useGroup(groupId ?? undefined, me);
  useFocusEffect(
    useCallback(() => {
      refreshGroup();
    }, [refreshGroup]),
  );

  const others = group && group.id === groupId ? group.members.filter((m) => m.user_id !== me) : [];
  const left = useMemo(() => new Set(off[groupId ?? ''] ?? []), [off, groupId]);
  const invited = others.filter((m) => !left.has(m.user_id));
  const toggleLeft = (uid: string) =>
    groupId && setOff((o) => ({ ...o, [groupId]: left.has(uid) ? [...left].filter((x) => x !== uid) : [...left, uid] }));

  const place = placeText.trim() ? parseMapsLink(placeText) : null;
  const placeBad = !!placeText.trim() && !place;
  const durationMin = DURATIONS.find((d) => d.id === duration)?.minutes ?? null;
  const days = useMemo(() => gridDays(new Date(), week), [week]);

  const togglePick = (day: Date, part: PartOfDay) => {
    const key = pickKey({ day, part });
    setPicks((ps) => (ps.some((p) => pickKey(p) === key) ? ps.filter((p) => pickKey(p) !== key) : [...ps, { day, part }]));
  };
  const addExact = () => {
    if (!exactDay || !exactTime) return;
    setPicks((ps) => [...ps, { day: exactDay, hour: exactTime.hour, minute: exactTime.minute }]);
    setExactOpen(false);
    setExactDay(null);
    setExactTime(null);
  };
  const setOneTime = (day: Date | null, time: { hour: number; minute: number } | null) => {
    setExactDay(day);
    setExactTime(time);
    setPicks(day && time ? [{ day, hour: time.hour, minute: time.minute }] : []);
  };

  const slots = picksToSlots(picks, durationMin);
  const n = slots.length;
  const canNext = !!group && invited.length > 0 && !placeBad;

  const send = async () => {
    if (!groupId || n === 0) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createHangout({
        groupId,
        kind,
        name,
        placeUrl: place?.url ?? null,
        placeName: place?.name ?? null,
        mode,
        durationMin,
        closesAt: mode === 'find' ? closes : null,
        slots,
        userIds: invited.map((m) => m.user_id),
      });
      router.replace({ pathname: '/hangout/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the hangout.");
    } finally {
      setSaving(false);
    }
  };

  const paste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setPlaceText(text);
    } catch {}
  };

  if (step === 'times') {
    const find = mode === 'find';
    const cta = n === 0 ? (find ? 'Pick at least one time' : 'Pick the day and time') : find ? `Send ${n} ${n === 1 ? 'option' : 'options'} to ${group?.name ?? 'the group'}` : 'Send the invite';
    return (
      <Screen footer={<Button label={cta} icon="send" loading={saving} onPress={n === 0 ? undefined : send} />}>
        <View style={styles.body}>
          <View style={styles.top}>
            <IconButton icon="back" accessibilityLabel="Back" onPress={() => setStep('details')} />
            <Text variant="callout" tone="secondary" numberOfLines={1} style={styles.topTitle}>
              {hangoutName(name, kind)}
            </Text>
            <View style={styles.topSpacer} />
          </View>
          <View style={styles.heading}>
            <Text variant="title" accessibilityRole="header">
              {find ? 'When could it work?' : 'When is it?'}
            </Text>
            <Text variant="callout" tone="secondary">
              {find ? 'Tap a few slots. The group picks from these.' : 'Set one time and everyone says in or out.'}
            </Text>
          </View>

          {find ? (
            <>
              <SlotGrid days={days} picks={picks} onToggle={togglePick} onWeek={(d) => setWeek((w) => Math.max(0, w + d))} canGoBack={week > 0} />
              {exactOpen ? (
                <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.line }]}>
                  <DayTimeChips days={days} day={exactDay} time={exactTime} onDay={setExactDay} onTime={setExactTime} />
                  <Button label="Add this time" size="sm" variant="secondary" onPress={exactDay && exactTime ? addExact : undefined} />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExactOpen(true)}
                  style={[styles.dashed, { borderColor: colors.dashed }]}>
                  <Icon name="clock" size={20} color={colors.irisText} />
                  <Text variant="label" style={{ color: colors.irisText }}>
                    Add an exact time
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <DayTimeChips
              days={gridDays(new Date(), 0).concat(gridDays(new Date(), 1))}
              day={exactDay}
              time={exactTime}
              onDay={(d) => setOneTime(d, exactTime)}
              onTime={(t) => setOneTime(exactDay, t)}
            />
          )}

          <View style={styles.field}>
            <Text variant="calloutStrong">Lasts about</Text>
            <View style={styles.durations} accessibilityRole="radiogroup" accessibilityLabel="Lasts about">
              {DURATIONS.map((d) => (
                <Chip key={d.id} label={d.label} selected={d.id === duration} onPress={() => setDuration(d.id)} style={styles.duration} />
              ))}
            </View>
          </View>

          {find ? (
            <Text variant="caption" tone="secondary" style={styles.center}>
              Answers close {closesLabel(closes.toISOString())}
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  const find = mode === 'find';
  return (
    <Screen
      footer={
        <Button
          label={find ? 'Next: suggest times' : 'Next: pick the time'}
          iconRight="arrowRight"
          onPress={canNext ? () => setStep('times') : undefined}
        />
      }>
      <View style={styles.body}>
        <View style={styles.top}>
          <IconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
          <Text variant="callout" tone="secondary" style={styles.topTitle}>
            Quick hangout
          </Text>
          <View style={styles.topSpacer} />
        </View>
        <Text variant="title" accessibilityRole="header">
          What’s the plan?
        </Text>

        <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="What kind of hangout">
          {KINDS.map((k) => {
            const on = k.id === kind;
            return (
              <Pressable
                key={k.id}
                accessibilityRole="radio"
                accessibilityLabel={k.label}
                accessibilityState={{ selected: on }}
                onPress={() => setKind(k.id)}
                style={[styles.kind, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line }]}>
                <Icon name={k.icon} size={18} color={on ? colors.onInk : colors.text} />
                <Text variant="calloutStrong" style={{ color: on ? colors.onInk : colors.text }}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Name it (optional)"
          value={name}
          onChangeText={setName}
          maxLength={MAX_HANGOUT_NAME}
          placeholder={kindName(kind)}
          returnKeyType="done"
        />

        <View style={styles.field}>
          {place ? (
            <>
              <Text variant="calloutStrong">Where (optional)</Text>
              <View style={[styles.place, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <View style={[styles.placeIcon, { backgroundColor: colors.tint.plan }]}>
                <Icon name="pin" size={20} />
              </View>
              <View style={styles.placeText}>
                <Text variant="label" numberOfLines={1}>
                  {place.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  From your Google Maps link
                </Text>
              </View>
              <IconButton icon="close" accessibilityLabel="Remove place" onPress={() => setPlaceText('')} />
              </View>
            </>
          ) : (
            <View style={styles.placeRow}>
              <Input
                label="Where (optional)"
                accessibilityLabel="Google Maps link"
                containerStyle={styles.placeInput}
                value={placeText}
                onChangeText={setPlaceText}
                placeholder="Paste a Google Maps link"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                error={placeBad ? 'That doesn’t look like a Google Maps link.' : null}
              />
              <Button label="Paste" size="sm" variant="secondary" onPress={paste} />
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text variant="calloutStrong">Who’s invited</Text>
          {groups.length === 0 ? (
            <Text variant="callout" tone="secondary" accessibilityLiveRegion="polite">
              {loading ? 'Loading your groups' : 'You’re not in a group yet. Make one on the Groups tab, then plan a hangout with it.'}
            </Text>
          ) : (
            <>
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Groups">
                {groups.map((g) => (
                  <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => setPicked(g.id)} />
                ))}
              </View>
              <View style={styles.countRow}>
                <Text variant="callout" tone="secondary">
                  {invited.length} of {others.length} from {group?.name ?? 'the group'}
                </Text>
                <Button label={changing ? 'Done' : 'Change'} variant="ghost" size="sm" onPress={() => setChanging((c) => !c)} />
              </View>
              {changing ? <MemberGrid people={others} off={left} onToggle={toggleLeft} /> : null}
            </>
          )}
        </View>

        <View style={styles.field}>
          <Text variant="calloutStrong">When</Text>
          <Segmented
            options={[
              { value: 'find', label: 'Find a time together' },
              { value: 'set', label: 'I’ll pick it' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setPicks([]);
              setExactDay(null);
              setExactTime(null);
            }}
          />
          <Text variant="caption" tone="secondary">
            {find ? 'Suggest a few slots, friends tap what works.' : 'Set one time and everyone says in or out.'}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { flex: 1, textAlign: 'center' },
  topSpacer: { width: 44 },
  heading: { gap: space.xs },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kind: { width: '31.5%', flexGrow: 1, height: 48, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s6 },
  field: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  place: { borderWidth: 1, borderRadius: radius.lg, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md },
  placeIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  placeText: { flex: 1, minWidth: 0 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  placeInput: { flex: 1 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.md },
  dashed: { height: 48, borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  durations: { flexDirection: 'row', gap: space.sm },
  duration: { flex: 1 },
  center: { textAlign: 'center' },
});
