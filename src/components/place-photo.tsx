import { Image, type ImageProps } from 'expo-image';
import { useEffect, useMemo } from 'react';

import type { Destination } from '@/lib/destinations';
import { downloadLocalCopy, localPhotoUri } from '@/lib/place-photo';

type Props = Omit<ImageProps, 'source'> & {
  place: Pick<Destination, 'id' | 'trip_id' | 'image_path' | 'photoUrl'>;
};

/**
 * A place's photo: the copy in the device's Huddle folder when there is one, otherwise the uploaded photo
 * (which is then saved to the folder in the background), or the web image link for older places.
 */
export function PlacePhoto({ place, ...props }: Props) {
  const { id, trip_id, image_path, photoUrl } = place;
  const local = useMemo(() => (image_path ? localPhotoUri(trip_id, id) : null), [trip_id, id, image_path]);

  useEffect(() => {
    if (image_path && photoUrl && !local) downloadLocalCopy(trip_id, id, photoUrl);
  }, [trip_id, id, image_path, photoUrl, local]);

  const source = local ? { uri: local } : photoUrl ? { uri: photoUrl, cacheKey: image_path ?? undefined } : null;
  if (!source) return null;
  return <Image source={source} contentFit="cover" transition={150} {...props} />;
}
