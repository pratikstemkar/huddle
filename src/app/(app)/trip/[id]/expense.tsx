import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { CATEGORY_LABEL, confirmAction, nameMap } from '@/components/split/people';
import { closeSheet, SheetHeader } from '@/components/split/sheet-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { amountInput, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { CATEGORIES, deleteExpense, equalShares, saveExpense, useSplit, type Category } from '@/lib/split';
import { useTrip } from '@/lib/trips';
import { radius, space, type } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MAX_TITLE = 60;

type Errors = { amount?: string; title?: string; split?: string; form?: string };

/** Turns a save error into something a person can act on. */
function saveMessage(e: unknown): string {
  const message = (e as { message?: string } | null)?.message ?? '';
  if (message.includes('only edit your own')) return 'You can only edit expenses you added.';
  if (message.includes('must be in the trip')) return 'Someone in the split has left the trip. Untick them and try again.';
  if (message.includes('Pick who to split')) return 'Pick at least one person to split with.';
  return "Couldn't save the expense. Check your connection and try again.";
}

export default function ExpenseSheet() {
  const { id, expense: expenseId } = useLocalSearchParams<{ id: string; expense?: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading: tripLoading, refresh: refreshTrip } = useTrip(id, me);
  const { expenses, loading: splitLoading, refresh: refreshSplit } = useSplit(expenseId ? id : undefined);

  // null until the person changes a field, so the defaults (or the expense being edited) show until then.
  const [amountText, setAmountText] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [splitWith, setSplitWith] = useState<string[] | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshTrip();
      refreshSplit();
    }, [refreshTrip, refreshSplit]),
  );

  const editing = expenses.find((e) => e.id === expenseId) ?? null;
  const names = useMemo(() => nameMap(trip?.members ?? []), [trip?.members]);

  if ((tripLoading && !trip) || (expenseId && splitLoading)) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  const isOrganiser = !!trip && trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const blocked = !trip
    ? "This trip doesn't exist, or you're not a member of it."
    : expenseId && !editing
      ? "This expense isn't here any more. Someone may have deleted it."
      : editing && editing.created_by !== me && !isOrganiser
        ? 'You can only edit expenses you added.'
        : null;
  if (!trip || blocked) {
    return (
      <Screen footer={<Button label="Close" onPress={() => closeSheet(id)} />}>
        <SheetHeader title={expenseId ? 'Edit expense' : 'Add expense'} tripId={id} />
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          {blocked}
        </Text>
      </Screen>
    );
  }

  const currency = trip.currency || 'INR';
  // People who left but are already on this expense stay pickable, so editing doesn't drop them silently.
  const people = [...trip.members.map((m) => m.user_id)];
  for (const u of [editing?.paid_by, ...(editing?.shares.map((s) => s.user_id) ?? [])]) {
    if (u && !people.includes(u)) people.push(u);
  }
  const label = (u: string) => (u === me ? 'You' : (names.get(u) ?? 'Someone'));

  const amountValue = amountText ?? (editing ? amountInput(editing.amount_minor) : '');
  const titleValue = title ?? editing?.title ?? '';
  const categoryValue = category ?? editing?.category ?? 'other';
  const payer = paidBy ?? editing?.paid_by ?? me ?? null;
  const chosen =
    splitWith ?? (editing ? editing.shares.map((s) => s.user_id).filter((u): u is string => !!u) : trip.members.map((m) => m.user_id));

  const minor = parseAmount(amountValue);
  const preview = (() => {
    const n = chosen.length;
    if (!n) return 'Pick who’s in the split';
    const head = n === 1 ? `just ${label(chosen[0]) === 'You' ? 'you' : label(chosen[0])}` : `split ${n} ways`;
    if (minor === null) return head;
    const shares = [...equalShares(minor, chosen).values()];
    const lo = Math.min(...shares);
    const hi = Math.max(...shares);
    const each = lo === hi ? formatMoney(lo, currency) : `${formatMoney(lo, currency)}–${formatMoney(hi, currency)}`;
    return n === 1 ? `${head} · ${each}` : `${head} · ${each} each`;
  })();

  const clear = (key: keyof Errors) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  const toggle = (u: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSplitWith(chosen.includes(u) ? chosen.filter((x) => x !== u) : [...chosen, u]);
    clear('split');
  };

  const save = async () => {
    const next: Errors = {};
    if (minor === null) next.amount = 'Enter an amount, like 1,250.';
    if (!titleValue.trim()) next.title = 'Say what it was for.';
    if (!chosen.length) next.split = 'Pick at least one person to split with.';
    if (!payer) next.form = 'Pick who paid.';
    setErrors(next);
    if (Object.keys(next).length || minor === null || !payer) return;
    setSaving(true);
    try {
      await saveExpense(trip.id, {
        id: editing?.id,
        title: titleValue,
        category: categoryValue,
        amountMinor: minor,
        paidBy: payer,
        splitWith: chosen,
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeSheet(id);
    } catch (e) {
      setErrors({ form: saveMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirmAction('Delete this expense?', "It comes off everyone's balances. This can't be undone.", 'Delete');
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteExpense(editing.id);
      closeSheet(id);
    } catch {
      setErrors({ form: "Couldn't delete the expense. Check your connection and try again." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {errors.form ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {errors.form}
            </Text>
          ) : null}
          <Button label="Save expense" loading={saving} onPress={save} />
          {editing ? <Button label="Delete expense" variant="ghost" loading={deleting} onPress={remove} /> : null}
        </View>
      }
      contentStyle={styles.content}>
      <SheetHeader title={editing ? 'Edit expense' : 'Add expense'} tripId={id} />

      <View style={styles.field}>
        <View
          style={[
            styles.amount,
            { backgroundColor: colors.card },
            errors.amount ? { borderWidth: 2, borderColor: colors.danger } : { borderWidth: 1, borderColor: colors.lineStrong },
          ]}>
          <Text variant="display" tone="secondary">
            {currencySymbol(currency)}
          </Text>
          <TextInput
            value={amountValue}
            onChangeText={(t) => {
              setAmountText(t);
              clear('amount');
            }}
            accessibilityLabel="Amount"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={16}
            autoFocus={!editing}
            style={[styles.amountInput, { color: colors.text }]}
          />
        </View>
        {errors.amount ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {errors.amount}
          </Text>
        ) : null}
      </View>

      <Input
        label="What for"
        value={titleValue}
        onChangeText={(t) => {
          setTitle(t);
          clear('title');
        }}
        placeholder="Villa, 4 nights"
        maxLength={MAX_TITLE}
        error={errors.title}
        returnKeyType="done"
      />

      <Group label="Category">
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABEL[c]}
            selected={categoryValue === c}
            onPress={() => {
              setCategory(c);
              clear('form');
            }}
          />
        ))}
      </Group>

      <Group label="Paid by">
        {people.map((u) => (
          <Chip
            key={u}
            label={label(u)}
            accessibilityLabel={`Paid by ${label(u)}`}
            selected={payer === u}
            onPress={() => {
              setPaidBy(u);
              clear('form');
            }}
          />
        ))}
      </Group>

      <View style={styles.field}>
        <Group label="Split between">
          {people.map((u) => (
            <Chip key={u} label={label(u)} accessibilityLabel={`Split with ${label(u)}`} selected={chosen.includes(u)} onPress={() => toggle(u)} />
          ))}
        </Group>
        <Text variant="callout" tone="secondary" accessibilityLiveRegion="polite" testID="split-preview">
          {preview}
        </Text>
        {errors.split ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {errors.split}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="calloutStrong">{label}</Text>
      <View style={styles.chips} accessibilityLabel={label}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.xl },
  field: { gap: space.sm },
  amount: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 80, paddingHorizontal: space.s20, borderRadius: radius.lg },
  amountInput: { flex: 1, minWidth: 0, ...type.display, paddingVertical: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
