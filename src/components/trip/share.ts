import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share } from 'react-native';

import { useToast } from '@/components/ui/toast';

/**
 * Opens the share sheet with `message`. Browsers without the Web Share API can't open one, so the message
 * is copied instead and `copied` turns true for 1.8s.
 */
export function useShareOrCopy() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const share = useCallback(async (message: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      try {
        await Clipboard.setStringAsync(message);
        setCopied(true);
        toast.show('Copied to clipboard');
      } catch {}
      return;
    }
    try {
      await Share.share({ message });
    } catch {}
  }, [toast]);

  return { share, copied };
}
