import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { formatDay, type Day } from '@/lib/dates';
import {
  addPlanItem,
  deletePlanItem,
  formatTime,
  MAX_PLAN_NOTE,
  MAX_PLAN_TITLE,
  parseTime,
  planErrorMessage,
  tripDays,
  updatePlanItem,
  usePlan,
  weekday,
  type PlanItem,
} from '@/lib/itinerary';
import { tripDates } from '@/lib/trip-status';
import { useTrip } from '@/lib/trips';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const QUICK_TIMES = ['9:00', '13:00', '18:00'];

export default function PlanItemSheet() {
  const { id, day: dayParam, item: itemId } = useLocalSearchParams<{ id: string; day?: string; item?: string }>();
  const { session } = useAuth();
  const myId = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading: tripLoading, refresh: refreshTrip } = useTrip(id, myId);
  const plan = usePlan(id);
  const refreshPlan = plan.refresh;

  useFocusEffect(
    useCallback(() => {
      refreshTrip();
      refreshPlan();
    }, [refreshTrip, refreshPlan]),
  );

  const editing = !!itemId;
  const item = editing ? plan.items.find((i) => i.id === itemId) : undefined;

  const dates = trip ? tripDates(trip) : null;
  const start = dates?.start;
  const end = dates?.end;
  const days = useMemo(() => (start && end ? tripDays(start, end) : []), [start, end]);
  const initialDay = item ? item.day : dayParam && days.includes(dayParam) ? dayParam : (days[0] ?? null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/trip/[id]/plan', params: { id: id ?? '' } });
  };

  const header = (heading: string, withClose = true) => (
    <View style={styles.header}>
      <Text variant="titleSm" style={{ flex: 1 }}>
        {heading}
      </Text>
      {withClose ? <IconButton icon="close" accessibilityLabel="Close" onPress={close} /> : null}
    </View>
  );

  if ((tripLoading && !trip) || (editing && plan.loading && !item)) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  const isOrganiser = !!trip && trip.members.some((m) => m.user_id === myId && m.role === 'organiser');
  const canEdit = !!item && (isOrganiser || (!!myId && item.created_by === myId));

  const blocked = !trip
    ? "This trip doesn't exist, or you're not a member of it."
    : editing && !item
      ? 'This plan has been removed.'
      : editing && !canEdit
        ? 'Only the person who added this, or an organiser, can change it.'
        : !editing && days.length === 0
          ? 'The plan opens once the dates are locked. Pick them in Vote.'
          : null;
  if (blocked || !trip) {
    return (
      <Screen footer={<Button label="Close" onPress={close} />}>
        {header(editing ? 'Edit plan' : 'Add a plan', false)}
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          {blocked}
        </Text>
      </Screen>
    );
  }

  return <PlanForm key={item?.id ?? 'new'} tripId={trip.id} days={days} item={item} initialDay={initialDay} close={close} header={header} />;
}

type FormProps = {
  tripId: string;
  days: Day[];
  item: PlanItem | undefined;
  initialDay: Day | null;
  close: () => void;
  header: (heading: string, withClose?: boolean) => ReactNode;
};

function PlanForm({ tripId, days, item, initialDay, close, header }: FormProps) {
  const editing = !!item;
  const [day, setDay] = useState<Day | null>(initialDay);
  const [time, setTime] = useState(item ? formatTime(item.start_time) : '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const chosen = day;

  const clear = () => {
    if (error) setError(null);
  };

  const save = async () => {
    if (!chosen || !days.includes(chosen)) return setError('Pick one of the trip’s days.');
    if (!parseTime(time)) return setError(planErrorMessage(new Error('BAD_TIME')));
    if (!title.trim()) return setError('Give the plan a title.');
    setSaving(true);
    try {
      const input = { day: chosen, time, title, note };
      if (item) await updatePlanItem(item.id, input);
      else await addPlanItem(tripId, input);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch (e) {
      setError(planErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await deletePlanItem(item.id);
      close();
    } catch {
      setError("Couldn't delete the plan. Check your connection and try again.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = editing ? 'Save changes' : chosen ? `Add to ${weekday(chosen)}` : 'Add to the plan';

  return (
    <Screen footer={<Button label={saveLabel} loading={saving} onPress={save} />}>
      <View style={styles.form}>
        {header(editing ? 'Edit plan' : 'Add a plan')}

        <View style={styles.field}>
          <Text variant="calloutStrong">Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            {days.map((d) => (
              <Chip
                key={d}
                label={formatDay(d, { weekday: 'short', day: 'numeric' })}
                accessibilityLabel={formatDay(d, { weekday: 'long', month: 'long', day: 'numeric' })}
                selected={d === chosen}
                onPress={() => {
                  setDay(d);
                  clear();
                }}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Input
            label="Time"
            value={time}
            onChangeText={(t) => {
              setTime(t);
              clear();
            }}
            placeholder="9:30"
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={8}
          />
          <View style={styles.quick}>
            {QUICK_TIMES.map((t) => (
              <Chip
                key={t}
                label={t}
                accessibilityLabel={`Set the time to ${t}`}
                selected={parseTime(time) === parseTime(t)}
                onPress={() => {
                  setTime(t);
                  clear();
                }}
              />
            ))}
          </View>
        </View>

        <Input
          label="Title"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            clear();
          }}
          placeholder="Sunset at the fort"
          maxLength={MAX_PLAN_TITLE}
        />
        <Input
          label="Note"
          value={note}
          onChangeText={(t) => {
            setNote(t);
            clear();
          }}
          placeholder="Where, or anything to know"
          maxLength={MAX_PLAN_NOTE}
          multiline
        />

        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {editing ? (
          confirming ? (
            <View style={styles.confirm}>
              <Text variant="callout" tone="secondary">
                Delete “{item?.title}” from the plan?
              </Text>
              <View style={styles.confirmRow}>
                <Button label="Keep it" variant="outline" size="sm" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
                <Button label="Yes, delete" variant="ink" size="sm" loading={saving} onPress={remove} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Button label="Delete" variant="ghost" size="sm" onPress={() => setConfirming(true)} accessibilityLabel="Delete this plan" />
          )
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  form: { gap: space.s20 },
  field: { gap: space.sm },
  chipScroll: { marginHorizontal: -space.screenX, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.screenX },
  quick: { flexDirection: 'row', gap: space.sm },
  confirm: { gap: space.md },
  confirmRow: { flexDirection: 'row', gap: space.md },
});
