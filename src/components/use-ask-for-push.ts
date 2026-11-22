import { useEffect } from 'react';

import { useConfirm } from '@/components/ui/confirm-sheet';
import { askForPushOnce } from '@/lib/notifications';

/** Lets the screen settle before a sheet slides over it. */
const ASK_DELAY_MS = 1200;

/**
 * Offers push once per phone, the first time a screen where a ping matters is open and `when` holds:
 * a trip, a group, or the Groups tab with an invite or group in it. Native only; does nothing after the
 * first ask.
 */
export function useAskForPush(when = true) {
  const confirm = useConfirm();

  useEffect(() => {
    if (!when) return;
    const t = setTimeout(() => {
      askForPushOnce(() =>
        confirm({
          title: 'Get a ping when the plan moves?',
          message: "Huddle can tell you when you're invited, when a trip is locked, and when the group is waiting on you.",
          confirmLabel: 'Turn on',
          cancelLabel: 'Not now',
        }),
      );
    }, ASK_DELAY_MS);
    return () => clearTimeout(t);
  }, [confirm, when]);
}
