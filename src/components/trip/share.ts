import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share } from 'react-native';

/**
 * Opens the share sheet with `message`. Browsers without the Web Share API can't open one, so the message
 * is copied instead and `copied` turns true for 1.8s.
 */
export function useShareOrCopy() {
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
      } catch {}
      return;
    }
    try {
      await Share.share({ message });
    } catch {}
  }, []);

  return { share, copied };
}
