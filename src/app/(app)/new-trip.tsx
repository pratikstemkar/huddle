import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { DateRangePicker, type DayRange } from '@/components/date-range-picker';
import { InvitePanel } from '@/components/invite-panel';
import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { createTrip, updateTrip } from '@/lib/trips';
import { radius, space, tripColors, type TintArea, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type DatesChoice = 'vote' | 'fixed';

function OptionCard({
  title,
  sub,
  icon,
  area,
  selected,
  onPress,
}: {
  title: string;
  sub: string;
  icon: IconName;
  area: TintArea;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={sub}
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.option,
        { backgroundColor: colors.card },
        selected ? { borderWidth: 2, borderColor: colors.iris, padding: 11, paddingHorizontal: 15 } : { borderWidth: 1, borderColor: colors.line },
      ]}>
      <View style={[styles.optionIcon, { backgroundColor: colors.tint[area] }]}>
        <Icon name={icon} size={20} />
      </View>
      <View style={styles.optionText}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

function StepHeader({ step, icon, label, onPress }: { step: 1 | 2; icon: IconName; label: string; onPress: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon={icon} accessibilityLabel={label} onPress={onPress} />
      <Text variant="calloutStrong" tone="secondary">
        Step {step} of 2
      </Text>
      <View style={styles.spacer} />
    </View>
  );
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function NewTrip() {
  // Started from a group's card or details: the trip is linked to that group.
  const params = useLocalSearchParams<{ group?: string }>();
  const groupId = typeof params.group === 'string' && params.group ? params.group : null;
  const [step, setStep] = useState<1 | 2>(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<TripColor>('iris');
  const [dates, setDates] = useState<DatesChoice>('vote');
  const [range, setRange] = useState<DayRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your trip a name first.');
      return;
    }
    const fixed = dates === 'fixed' ? range : null;
    if (dates === 'fixed' && !fixed) {
      setDatesError('Pick the first and last day of the trip.');
      return;
    }
    setSaving(true);
    try {
      if (createdId) {
        await updateTrip(createdId, { name: trimmed, color, fixed_start: fixed?.start ?? null, fixed_end: fixed?.end ?? null });
      } else {
        const trip = await createTrip(trimmed, color, fixed, groupId);
        setCreatedId(trip.id);
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(2);
    } catch {
      setError(
        createdId ? "Couldn't save the trip. Check your connection and try again." : "Couldn't create the trip. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (step === 2 && createdId) {
    return (
      <Screen
        footer={
          <Button
            label="Go to the trip"
            variant="ink"
            onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: createdId } })}
          />
        }>
        <View style={styles.body}>
          <StepHeader step={2} icon="back" label="Back" onPress={() => setStep(1)} />
          <InvitePanel tripId={createdId} groupId={groupId} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Next: invite people" iconRight="arrowRight" loading={saving} onPress={next} />}>
      <View style={styles.body}>
        <StepHeader step={1} icon="close" label="Close" onPress={close} />

        <View style={styles.titleRow}>
          <Text variant="title" style={styles.flex}>
            Start a new trip
          </Text>
          <Pip mood="hmm" size={76} tilt={5} scarf={tripColors[color]} />
        </View>

        <Input
          label="What should we call it?"
          accessibilityLabel="Trip name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(null);
          }}
          error={error}
          placeholder="Goa getaway"
          returnKeyType="next"
          onSubmitEditing={next}
          maxLength={60}
        />

        <View style={styles.group}>
          <Text variant="calloutStrong">Pick a colour</Text>
          <ColorSwatches value={color} onChange={setColor} />
          <Text variant="caption" tone="secondary">
            Pip wears it, and so does the trip card.
          </Text>
        </View>

        <View style={styles.group}>
          <Text variant="calloutStrong">Dates</Text>
          <View accessibilityRole="radiogroup" style={styles.group}>
            <OptionCard
              title="Let the group vote"
              sub="Everyone marks the days they're free"
              icon="vote"
              area="vote"
              selected={dates === 'vote'}
              onPress={() => {
                setDates('vote');
                setDatesError(null);
              }}
            />
            <OptionCard
              title="I already know"
              sub="Set the dates yourself"
              icon="plan"
              area="plan"
              selected={dates === 'fixed'}
              onPress={() => setDates('fixed')}
            />
          </View>
          {dates === 'fixed' ? (
            <DateRangePicker
              value={range}
              onChange={(v) => {
                setRange(v);
                setDatesError(null);
              }}
            />
          ) : null}
          {datesError ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {datesError}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.s20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 44 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  flex: { flex: 1 },
  group: { gap: space.s10 },
  option: {
    minHeight: 64,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  optionIcon: { width: 40, height: 40, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: space.xxs },
});
