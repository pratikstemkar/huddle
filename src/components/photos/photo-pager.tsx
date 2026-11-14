import { Image } from 'expo-image';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import type { AlbumPhoto } from '@/lib/trip-photos';

type Props = {
  photos: AlbumPhoto[];
  width: number;
  height: number;
  initialIndex: number;
  fullUrls: Map<string, string>;
  label: (photo: AlbumPhoto) => string;
  onIndexChange: (index: number) => void;
};

type Viewable = { index?: number | null; isViewable: boolean };

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/** Full-screen photos, one per page, swiped sideways. Shows the thumbnail until the full photo arrives. */
export const PhotoPager = forwardRef<FlatList<AlbumPhoto>, Props>(function PhotoPager(
  { photos, width, height, initialIndex, fullUrls, label, onIndexChange },
  ref,
) {
  const latest = useRef(onIndexChange);
  useEffect(() => {
    latest.current = onIndexChange;
  });
  // FlatList requires the same callback for its whole life.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: Viewable[] }) => {
    const first = viewableItems.find((v) => v.isViewable && v.index != null);
    if (first?.index != null) latest.current(first.index);
  });

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: width, offset: width * index, index }), [width]);

  return (
    <FlatList
      ref={ref}
      data={photos}
      keyExtractor={(p) => p.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={Math.min(initialIndex, Math.max(0, photos.length - 1))}
      getItemLayout={getItemLayout}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={VIEWABILITY}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      renderItem={({ item }) => {
        const full = fullUrls.get(item.path);
        return (
          <View style={{ width, height }}>
            <Image
              source={full ? { uri: full, cacheKey: item.path } : item.thumbUrl ? { uri: item.thumbUrl, cacheKey: item.thumb_path } : null}
              placeholder={item.thumbUrl ? { uri: item.thumbUrl, cacheKey: item.thumb_path } : undefined}
              placeholderContentFit="contain"
              contentFit="contain"
              transition={150}
              style={styles.image}
              accessibilityLabel={label(item)}
            />
          </View>
        );
      }}
    />
  );
});

const styles = StyleSheet.create({
  image: { flex: 1 },
});
