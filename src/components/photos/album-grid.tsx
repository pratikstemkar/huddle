import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TILE_MIN, masonry, type AlbumPhoto } from '@/lib/trip-photos';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import type { UploadProgress } from './use-album-upload';

const GAP = 10;
const TILE_RADIUS = 22;

type TileProps = { photo: AlbumPhoto; height: number; caption: string; onPress: () => void };

export function PhotoTile({ photo, height, caption, onPress }: TileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo, ${caption}`}
      accessibilityHint="Opens the photo"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { height, backgroundColor: colors.tint.photos }, pressed && styles.pressed]}>
      {photo.thumbUrl ? (
        <Image
          source={{ uri: photo.thumbUrl, cacheKey: photo.thumb_path }}
          recyclingKey={photo.id}
          contentFit="cover"
          transition={150}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      ) : (
        <View style={styles.missing}>
          <Icon name="photos" size={26} color={colors.textMuted} />
        </View>
      )}
      <View style={[styles.caption, { backgroundColor: colors.card }]}>
        <Text variant="badge" numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

export function UploadTile({ progress }: { progress: UploadProgress }) {
  const { colors } = useTheme();
  const label = `Uploading ${progress.current} of ${progress.total}`;
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.tile, styles.upload, { height: TILE_MIN, backgroundColor: colors.tint.photos }]}>
      <ActivityIndicator color={colors.irisText} />
      <Text variant="calloutStrong" tone="iris">
        {label}
      </Text>
    </View>
  );
}

type GridProps = {
  photos: AlbumPhoto[];
  width: number;
  caption: (photo: AlbumPhoto) => string;
  onOpen: (photo: AlbumPhoto) => void;
  onAdd: () => void;
  progress: UploadProgress | null;
};

/** Two masonry columns of thumbnails, ending with "Add yours" (or the upload's progress) in the shorter column. */
export function AlbumGrid({ photos, width, caption, onOpen, onAdd, progress }: GridProps) {
  const colWidth = Math.max(1, (width - GAP) / 2);
  const { left, right, shorter } = masonry(photos, colWidth, GAP);
  const last = progress ? (
    <UploadTile progress={progress} />
  ) : (
    <Button label="Add yours" variant="suggest" tall icon="camera" onPress={onAdd} accessibilityHint="Adds your photos to the album" />
  );
  const column = (items: typeof left, side: 'left' | 'right') => (
    <View style={styles.column}>
      {items.map((p) => (
        <PhotoTile key={p.id} photo={p} height={p.h} caption={caption(p)} onPress={() => onOpen(p)} />
      ))}
      {shorter === side ? last : null}
    </View>
  );
  return (
    <View style={styles.grid}>
      {column(left, 'left')}
      {column(right, 'right')}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: GAP },
  column: { flex: 1, gap: GAP },
  tile: { borderRadius: TILE_RADIUS, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '85%',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.badge,
  },
  upload: { alignItems: 'center', justifyContent: 'center', gap: space.s6, paddingHorizontal: space.md },
});
