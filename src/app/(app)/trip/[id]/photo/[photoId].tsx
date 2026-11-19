import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, useWindowDimensions, type FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseChip, viewerCaption } from '@/components/photos/album-copy';
import { PhotoPager } from '@/components/photos/photo-pager';
import { useConfirm } from '@/components/ui/confirm-sheet';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { deleteAlbumPhoto, filterPhotos, signFull, useAlbum, type AlbumPhoto } from '@/lib/trip-photos';
import { tripDates } from '@/lib/trip-status';
import { useTrip } from '@/lib/trips';
import { MIN_TOUCH, palette, radius, space } from '@/theme/tokens';

/** The viewer is dark in both modes so photos read true; light-mode ink is the darkest token. */
const BG = palette.light.ink;
const FG = palette.light.onInk;
const CONTROL = 'rgba(255, 255, 255, 0.16)';

function close(tripId: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/trip/[id]/photos', params: { id: tripId } });
}

type ControlProps = { label: string; icon: 'close' | 'back' | 'chevronRight'; showLabel?: boolean; onPress: () => void; disabled?: boolean };

function ControlButton({ label, icon, showLabel, onPress, disabled }: ControlProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.control, !showLabel && styles.round, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={22} color={FG} />
      {showLabel ? (
        <Text variant="calloutStrong" style={{ color: FG }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function PhotoViewer() {
  const confirm = useConfirm();
  const { id = '', photoId = '', filter } = useLocalSearchParams<{ id: string; photoId: string; filter?: string }>();
  const { width, height } = useWindowDimensions();
  const { session } = useAuth();
  const me = session?.user.id;
  const { trip, refresh: refreshTrip } = useTrip(id, me);
  const { photos, loading, refresh: refreshAlbum } = useAlbum(id);
  const [index, setIndex] = useState<number | null>(null);
  const [fullUrls, setFullUrls] = useState<Map<string, string>>(new Map());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pager = useRef<FlatList<AlbumPhoto>>(null);

  const refresh = useCallback(() => Promise.all([refreshTrip(), refreshAlbum()]), [refreshTrip, refreshAlbum]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useTripLive(id, refresh, ['trip_photos', 'trip_members', 'trips']);

  const dates = useMemo(() => (trip ? tripDates(trip) : null), [trip]);
  const names = useMemo(() => new Map((trip?.members ?? []).map((m) => [m.user_id, m.display_name])), [trip?.members]);
  const shown = useMemo(() => filterPhotos(photos, parseChip(filter), me, dates), [photos, filter, me, dates]);
  const startIndex = Math.max(0, shown.findIndex((p) => p.id === photoId));
  const current = shown.length ? Math.min(index ?? startIndex, shown.length - 1) : -1;
  const photo = current >= 0 ? shown[current] : null;
  const organiser = trip?.members.some((m) => m.user_id === me && m.role === 'organiser') ?? false;
  const canDelete = !!photo && (photo.uploaded_by === me || organiser);

  // Sign the full-size photo for the current page and its neighbours.
  const wanted = shown
    .slice(Math.max(0, current - 1), current + 2)
    .map((p) => p.path)
    .filter((p) => !fullUrls.has(p));
  const wantedKey = wanted.join(',');
  useEffect(() => {
    if (!wantedKey) return;
    let live = true;
    signFull(wantedKey.split(','))
      .then((signed) => {
        if (live && signed.size) setFullUrls((prev) => new Map([...prev, ...signed]));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wantedKey]);

  const goTo = (i: number) => {
    if (i < 0 || i >= shown.length) return;
    pager.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  };

  const remove = () => {
    if (!photo) return;
    confirm({ title: 'Delete this photo?', message: "It's removed for everyone on the trip.", destructive: true }).then(async (ok) => {
      if (!ok) return;
      setError(null);
      setDeleting(true);
      try {
        await deleteAlbumPhoto(photo);
        if (shown.length <= 1) {
          close(id);
          return;
        }
        setIndex(Math.min(current, shown.length - 2));
        await refreshAlbum();
      } catch {
        setError("Couldn't delete that photo. Check your connection and try again.");
      } finally {
        setDeleting(false);
      }
    });
  };

  const caption = photo ? viewerCaption(photo, me, names, dates) : '';

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <StatusBar style="light" />
      {loading && !photos.length ? (
        <ActivityIndicator accessibilityLabel="Loading photo" color={FG} style={styles.fill} />
      ) : !photo ? (
        <View style={[styles.fill, styles.centre]}>
          <Text variant="body" style={{ color: FG }}>
            {"This photo isn't in the album any more."}
          </Text>
        </View>
      ) : (
        <PhotoPager
          key={`${shown.length}:${width}`}
          ref={pager}
          photos={shown}
          width={width}
          height={height}
          initialIndex={current}
          fullUrls={fullUrls}
          label={(p) => `Photo, ${viewerCaption(p, me, names, dates)}`}
          onIndexChange={setIndex}
        />
      )}

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.bar}>
          <ControlButton label="Close" icon="close" showLabel onPress={() => close(id)} />
          {shown.length > 1 && photo ? (
            <Text variant="calloutStrong" style={{ color: FG }} accessibilityLabel={`Photo ${current + 1} of ${shown.length}`}>
              {current + 1} / {shown.length}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>

      {Platform.OS === 'web' && shown.length > 1 ? (
        <View style={styles.arrows} pointerEvents="box-none">
          <ControlButton label="Previous photo" icon="back" onPress={() => goTo(current - 1)} disabled={current <= 0} />
          <ControlButton label="Next photo" icon="chevronRight" onPress={() => goTo(current + 1)} disabled={current >= shown.length - 1} />
        </View>
      ) : null}

      <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
        {photo ? (
          <View style={styles.footer}>
            <View style={styles.captionPill}>
              <Text variant="calloutStrong" style={{ color: FG }} numberOfLines={1}>
                {caption}
              </Text>
            </View>
            {error ? (
              <Text variant="callout" accessibilityRole="alert" style={{ color: FG, textAlign: 'center' }}>
                {error}
              </Text>
            ) : null}
            {canDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
                accessibilityState={{ busy: deleting }}
                disabled={deleting}
                onPress={remove}
                style={({ pressed }) => [styles.control, { opacity: pressed ? 0.7 : 1 }]}>
                {deleting ? (
                  <ActivityIndicator color={FG} />
                ) : (
                  <Text variant="calloutStrong" style={{ color: FG }}>
                    Delete photo
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footer: { alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.lg },
  captionPill: { backgroundColor: CONTROL, borderRadius: radius.pill44, paddingVertical: space.s6, paddingHorizontal: space.md, maxWidth: '100%' },
  control: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill44,
    backgroundColor: CONTROL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s6,
  },
  round: { paddingHorizontal: 0 },
  arrows: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    top: '50%',
    marginTop: -MIN_TOUCH / 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
