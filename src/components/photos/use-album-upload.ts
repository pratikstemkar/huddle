import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { posthog } from '@/config/posthog';
import { PhotoPermissionError } from '@/lib/place-photo';
import { addAlbumPhoto, pickAlbumPhotos } from '@/lib/trip-photos';

export type UploadProgress = { current: number; total: number };

/** What to say after an upload where some photos failed; null when they all made it. */
export function uploadResultMessage(failed: number, total: number): string | null {
  if (!failed) return null;
  if (failed === total) {
    return total === 1
      ? "Couldn't add that photo. Check your connection and try again."
      : `Couldn't add those ${total} photos. Check your connection and try again.`;
  }
  return `${failed} of ${total} photos couldn't be added. The rest are in the album.`;
}

/**
 * Picks photos (library, or camera on native) and uploads them one by one. A failed photo is counted
 * and skipped, so the others still go in. Calls `onDone` once the batch is finished.
 */
export function useAlbumUpload(tripId: string | undefined, onDone: () => unknown) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  const upload = useCallback(
    async (from: 'library' | 'camera') => {
      if (!tripId || busy.current) return;
      setMessage(null);
      let picked;
      try {
        picked = await pickAlbumPhotos(from);
      } catch (e) {
        setMessage(e instanceof PhotoPermissionError ? 'Allow camera access in Settings to take a photo.' : "Couldn't open your photos. Try again.");
        return;
      }
      if (!picked.length) return;

      busy.current = true;
      let failed = 0;
      try {
        for (let i = 0; i < picked.length; i++) {
          setProgress({ current: i + 1, total: picked.length });
          try {
            await addAlbumPhoto(tripId, picked[i]);
          } catch {
            failed++;
          }
        }
      } finally {
        busy.current = false;
        setProgress(null);
      }
      const uploadedCount = picked.length - failed;
      setMessage(uploadResultMessage(failed, picked.length));
      if (uploadedCount > 0) {
        posthog?.capture('trip_photos_uploaded', {
          source: from,
          uploaded_count: uploadedCount,
          attempted_count: picked.length,
        });
      }
      if (Platform.OS !== 'web' && failed < picked.length) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onDone();
    },
    [tripId, onDone],
  );

  /** The browser can only open its file picker from the tap itself, so web goes straight to the library. */
  const choose = useCallback(() => {
    if (busy.current) return;
    if (Platform.OS === 'web') {
      upload('library');
      return;
    }
    Alert.alert('Add photos', undefined, [
      { text: 'Choose from library', onPress: () => upload('library') },
      { text: 'Take a photo', onPress: () => upload('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [upload]);

  return { choose, upload, progress, message };
}
