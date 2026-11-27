import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { DateRangePicker, type DayRange } from '@/components/date-range-picker';
import { InvitePanel } from '@/components/invite-panel';
import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { posthog } from '@/config/posthog';
import { createTripFromTemplate, nightsLabel, shiftPlan, useCatalogItinerary } from '@/lib/catalog';
import { nightsBetween } from '@/lib/dates';
import { posthogLogger } from '@/lib/posthog-logger';
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

function TemplateCard({ title, sub, onChange }: { title: string; sub: string; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.option, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }]}>
      <View style={[styles.optionIcon, { backgroundColor: colors.tint.plan }]}>
        <Icon name="plan" size={20} />
      </View>
      <View style={styles.optionText}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      </View>
      <Button label="Change" variant="ghost" size="sm" accessibilityLabel="Change plan" onPress={onChange} />
    </View>
  );
}

export default function NewTrip() {
  // Started from a group's card or details: the trip is linked to that group.
  // Started from a ready-made plan (`template`): the dates follow the plan's length and the plan is copied in.
  const params = useLocalSearchParams<{ group?: string; template?: string }>();
  const groupId = typeof params.group === 'string' && params.group ? params.group : null;
  const templateId = typeof params.template === 'string' && params.template ? params.template : undefined;
  const template = useCatalogItinerary(templateId);
  const loadTemplate = template.refresh;
  useFocusEffect(
    useCallback(() => {
      if (templateId) loadTemplate();
    }, [templateId, loadTemplate]),
  );
  const plan = templateId ? template.itinerary : null;
  const [step, setStep] = useState<1 | 2>(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // The first day the plan was copied onto, so a later change of start day can move it along.
  const [planStart, setPlanStart] = useState<string | null>(null);
  // Null until they type: a plan's trip suggests "<destination> trip".
  const [draft, setDraft] = useState<string | null>(null);
  const [color, setColor] = useState<TripColor>('iris');
  const [dates, setDates] = useState<DatesChoice>(templateId ? 'fixed' : 'vote');
  const [range, setRange] = useState<DayRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const name = draft ?? (template.destination ? `${template.destination.name} trip` : '');

  const next = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your trip a name first.');
      return;
    }
    const fixed = dates === 'fixed' ? range : null;
    if (dates === 'fixed' && !fixed) {
      setDatesError(plan ? 'Pick the first day of the trip.' : 'Pick the first and last day of the trip.');
      return;
    }
    setSaving(true);
    try {
      if (plan && fixed) {
        if (createdId) {
          await updateTrip(createdId, { name: trimmed, color, fixed_start: fixed.start, fixed_end: fixed.end });
          if (planStart && planStart !== fixed.start) {
            await shiftPlan(createdId, nightsBetween(planStart, fixed.start));
            setPlanStart(fixed.start);
          }
        } else {
          const id = await createTripFromTemplate({ itineraryId: plan.id, name: trimmed, color, start: fixed.start, groupId });
          posthog?.capture('trip_created', {
            dates_mode: 'fixed',
            linked_to_group: Boolean(groupId),
            source: 'template',
            template_id: plan.id,
          });
          posthogLogger.info('trip creation completed', {
            operation: 'trip_creation',
            outcome: 'completed',
            dates_mode: 'fixed',
            linked_to_group: Boolean(groupId),
            source: 'template',
          });
          setCreatedId(id);
          setPlanStart(fixed.start);
        }
      } else if (createdId) {
        await updateTrip(createdId, { name: trimmed, color, fixed_start: fixed?.start ?? null, fixed_end: fixed?.end ?? null });
      } else {
        const trip = await createTrip(trimmed, color, fixed, groupId);
        posthog?.capture('trip_created', {
          dates_mode: dates,
          linked_to_group: Boolean(groupId),
        });
        posthogLogger.info('trip creation completed', {
          operation: 'trip_creation',
          outcome: 'completed',
          dates_mode: dates,
          linked_to_group: Boolean(groupId),
        });
        setCreatedId(trip.id);
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(2);
    } catch (e) {
      // Template errors already read well (a removed plan, a group they left); the rest get the usual line.
      const friendly = plan && !createdId && e instanceof Error ? e.message : null;
      setError(
        friendly ??
          (createdId ? "Couldn't save the trip. Check your connection and try again." : "Couldn't create the trip. Check your connection and try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  const goToTrip = (id: string) => {
    // From a ready-made plan, the Explore screens sit underneath: clear them so Back from the trip goes Home.
    if (templateId) {
      router.dismissTo('/');
      router.push({ pathname: '/trip/[id]', params: { id } });
    } else {
      router.replace({ pathname: '/trip/[id]', params: { id } });
    }
  };

  if (templateId && !plan) {
    return (
      <Screen>
        <View style={styles.body}>
          <StepHeader step={1} icon="close" label="Close" onPress={close} />
          {template.loading ? (
            <Loading label="Loading the plan" />
          ) : (
            <ErrorState
              message={template.error ?? "That plan isn't available any more. Pick another one."}
              onRetry={template.error ? template.refresh : undefined}
            />
          )}
        </View>
      </Screen>
    );
  }

  if (step === 2 && createdId) {
    return (
      <Screen footer={<Button label="Go to the trip" variant="ink" onPress={() => goToTrip(createdId)} />}>
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

        {plan ? (
          <TemplateCard
            title={plan.title}
            sub={`${template.destination ? `${template.destination.name} · ` : ''}${nightsLabel(plan.nights)}, ${plan.items.length} plans to start with`}
            onChange={close}
          />
        ) : (
          <Card
            // Replace, not push: Explore is a normal screen, and it ends by opening this modal again with the plan.
            onPress={() => router.replace(groupId ? { pathname: '/explore', params: { group: groupId } } : '/explore')}
            chevron
            accessibilityLabel="Not sure where? Browse ready-made trips"
            accessibilityHint="Pick a place and a day-by-day plan">
            <View style={styles.optionText}>
              <Text variant="label">Not sure where?</Text>
              <Text variant="caption" tone="secondary">
                Browse ready-made trips with a day-by-day plan
              </Text>
            </View>
          </Card>
        )}

        <Input
          label="What should we call it?"
          accessibilityLabel="Trip name"
          value={name}
          onChangeText={(t) => {
            setDraft(t);
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

        {plan ? (
          <View style={styles.group}>
            <Text variant="calloutStrong">When do you start?</Text>
            <DateRangePicker
              nights={plan.nights}
              value={range}
              onChange={(v) => {
                setRange(v);
                setDatesError(null);
              }}
            />
            {datesError ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {datesError}
              </Text>
            ) : (
              <Text variant="caption" tone="secondary">
                The plan fills {nightsLabel(plan.nights)} from that day. You can change the dates later.
              </Text>
            )}
          </View>
        ) : (
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
        )}
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
