import { Alert, Platform } from 'react-native';

import type { Category, Expense, Settlement } from '@/lib/split';
import type { TripMember } from '@/lib/trips';
import type { IconName } from '@/components/ui/icon';
import type { TintArea } from '@/theme/tokens';

/** First names by user id, so rows read "Arjun paid" rather than a full name. */
export function nameMap(members: TripMember[]): Map<string, string> {
  return new Map(members.map((m) => [m.user_id, m.display_name.trim().split(/\s+/)[0] || 'Someone']));
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
