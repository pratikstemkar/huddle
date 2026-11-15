import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { Category, Expense, Settlement } from '@/lib/split';
import { supabase } from '@/lib/supabase';
import type { TripMember } from '@/lib/trips';
import type { IconName } from '@/components/ui/icon';
import type { TintArea } from '@/theme/tokens';

/** First names by user id, so rows read "Arjun paid" rather than a full name. */
export function nameMap(members: TripMember[]): Map<string, string> {
  return new Map(members.map((m) => [m.user_id, m.display_name.trim().split(/\s+/)[0] || 'Someone']));
}

/**
 * First names for everyone in the trip's money: current members, plus people who left but still paid,
 * owe or were paid. Members can read those profiles, so leavers keep their names instead of "Someone".
 */
export function useMoneyNames(members: TripMember[], expenses: Expense[], settlements: Settlement[]): Map<string, string> {
  const base = useMemo(() => nameMap(members), [members]);
  const missing = useMemo(() => {
    const ids = new Set<string>();
    for (const e of expenses) {
      if (e.paid_by) ids.add(e.paid_by);
      for (const s of e.shares) if (s.user_id) ids.add(s.user_id);
    }
    for (const x of settlements) {
      if (x.from_user) ids.add(x.from_user);
      if (x.to_user) ids.add(x.to_user);
    }
    return [...ids].filter((id) => !base.has(id)).sort();
  }, [base, expenses, settlements]);
  const key = missing.join(',');
  const [extra, setExtra] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!key) return;
    let live = true;
    supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', key.split(','))
      .then(({ data }) => {
        if (live && data) setExtra(new Map(data.map((p) => [p.id as string, String(p.display_name ?? '').trim().split(/\s+/)[0] || 'Someone'])));
      });
    return () => {
      live = false;
    };
  }, [key]);

  return useMemo(() => (extra.size ? new Map([...extra, ...base]) : base), [base, extra]);
}

/** "You" for me, a first name for a member, "Someone" for a deleted account or someone we can't see. */
export function who(names: Map<string, string>, id: string | null, me: string | undefined): string {
  if (!id) return 'Someone';
  if (id === me) return 'You';
  return names.get(id) ?? 'Someone';
}

/** The same, as the object of a sentence: "paid you", "just you". */
export function whom(names: Map<string, string>, id: string | null, me: string | undefined): string {
  const n = who(names, id, me);
  return n === 'You' ? 'you' : n;
}

/** "You paid · split 5 ways", or "Zoe paid · just Arjun" for a one-person split. */
export function expenseSubtitle(e: Expense, names: Map<string, string>, me: string | undefined): string {
  const payer = `${who(names, e.paid_by, me)} paid`;
  if (e.shares.length === 1) return `${payer} · just ${whom(names, e.shares[0].user_id, me)}`;
  return `${payer} · split ${e.shares.length} ways`;
}

/** "Arjun paid you", "You paid Zoe", "Arjun paid Zoe". */
export function settlementTitle(s: Settlement, names: Map<string, string>, me: string | undefined): string {
  return `${who(names, s.from_user, me)} paid ${whom(names, s.to_user, me)}`;
}

export const CATEGORY_LABEL: Record<Category, string> = { stay: 'Stay', travel: 'Travel', food: 'Food', other: 'Other' };

/** Each category's icon and the area tint behind it. */
export const CATEGORY_LOOK: Record<Category, { icon: IconName; area: TintArea }> = {
  stay: { icon: 'stay', area: 'split' },
  travel: { icon: 'ride', area: 'plan' },
  food: { icon: 'food', area: 'trip' },
  other: { icon: 'split', area: 'vote' },
};

/** A yes/no question before something destructive: a browser confirm on web, an alert on native. */
export function confirmAction(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title} ${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
