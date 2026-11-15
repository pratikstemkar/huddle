import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { albumHeader, chipLabel, chipParam } from '@/components/photos/album-copy';
import { AlbumGrid, UploadTile } from '@/components/photos/album-grid';
import { useAlbumUpload } from '@/components/photos/use-album-upload';
import { useRegisterPipAction } from '@/components/nav/pip-action';
import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { filterChips, filterPhotos, missingLine, photoCaption, useAlbum, type AlbumChip, type AlbumPhoto } from '@/lib/trip-photos';
import { tripDates } from '@/lib/trip-status';
import { useTrip } from '@/lib/trips';
import { MAX_CONTENT_WIDTH, navClearance, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { useTripId } from '@/components/nav/trip-id';

export default function PhotosTab() {
  const id = useTripId() ?? '';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { session } = useAuth();
  const me = session?.user.id;
  const { trip, loading: tripLoading, error: tripError, refresh: refreshTrip } = useTrip(id, me);
  const { photos, loading: albumLoading, error: albumError, refresh: refreshAlbum } = useAlbum(id);
  const [chip, setChip] = useState<AlbumChip>('all');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => Promise.all([refreshTrip(), refreshAlbum()]), [refreshTrip, refreshAlbum]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useTripLive(id, refresh, ['trip_photos', 'trip_members', 'trips']);

  const { choose, progress, message } = useAlbumUpload(id, refreshAlbum);
  useRegisterPipAction('Add photos', choose);

  const pullToRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const dates = useMemo(() => (trip ? tripDates(trip) : null), [trip]);
  const names = useMemo(() => new Map((trip?.members ?? []).map((m) => [m.user_id, m.display_name])), [trip?.members]);
  const chips = filterChips(photos, dates);
  const active = chips.includes(chip) ? chip : 'all';
  const shown = filterPhotos(photos, active, me, dates);
  const caption = (p: AlbumPhoto) => photoCaption(p, me, names, dates);
  const open = (p: AlbumPhoto) =>
    router.push({ pathname: '/trip/[id]/photo/[photoId]', params: { id, photoId: p.id, filter: chipParam(active) } });

  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH) - space.screenX * 2;
  const error = tripError ?? albumError;
  const firstLoad = (tripLoading && !trip) || (albumLoading && !photos.length);

  let body;
  if (firstLoad) {
    body = <ActivityIndicator accessibilityLabel="Loading photos" color={colors.irisText} style={styles.centre} />;
  } else if (error && !trip) {
    body = (
      <View style={styles.centre}>
        <Text variant="body" tone="secondary" style={styles.centreText}>
          {error}
        </Text>
        <Button label="Try again" variant="outline" size="md" onPress={refresh} />
      </View>
    );
  } else if (!trip) {
    body = (
      <Text variant="body" tone="secondary" style={[styles.centre, styles.centreText]}>
        {"This trip isn't available any more."}
      </Text>
    );
  } else if (!photos.length) {
    body = (
      <View style={styles.empty}>
        <Pip mood="snooze" size={120} />
        <Text variant="body" tone="secondary" style={styles.centreText}>
          {missingLine(trip.members.map((m) => m.user_id), photos, names, me)}
        </Text>
        <View style={styles.full}>
          {progress ? (
            <UploadTile progress={progress} />
          ) : (
            <Button label="Add yours" variant="suggest" tall icon="camera" onPress={choose} accessibilityHint="Adds your photos to the album" />
          )}
        </View>
      </View>
    );
  } else {
    body = (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
          {chips.map((c) => (
            <Chip key={String(c)} label={chipLabel(c)} selected={c === active} onPress={() => setChip(c)} />
          ))}
        </ScrollView>
        <AlbumGrid photos={shown} width={contentWidth} caption={caption} onOpen={open} onAdd={choose} progress={progress} />
        <SpeechCard>{missingLine(trip.members.map((m) => m.user_id), photos, names, me)}</SpeechCard>
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        style={styles.column}
        contentContainerStyle={[styles.content, { paddingBottom: navClearance(insets) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.irisText} colors={[colors.iris]} />}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text variant="callout" tone="secondary" numberOfLines={2}>
              {trip ? albumHeader(trip.name, photos) : ' '}
            </Text>
            <Text variant="title">Photos</Text>
          </View>
          {trip ? (
            <Button
              label="Add"
              size="sm"
              icon={<Icon name="plus" size={18} color={colors.onIris} strokeWidth={2.4} />}
              onPress={choose}
              loading={!!progress}
              accessibilityLabel="Add photos"
              style={styles.add}
            />
          ) : null}
        </View>
        {message ? (
          <Text variant="callout" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {message}
          </Text>
        ) : null}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: { flexGrow: 1, paddingHorizontal: space.screenX, paddingTop: space.md, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  titles: { flex: 1, gap: space.xs },
  add: { paddingHorizontal: space.lg },
  chipRow: { marginHorizontal: -space.screenX, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.screenX },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingVertical: space.xxxl },
  centreText: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: space.lg, paddingTop: space.xl },
  full: { alignSelf: 'stretch' },
});
