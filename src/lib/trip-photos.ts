import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { nightsBetween, today, type Day } from './dates';
import { ALBUM_BUCKET, PhotoPermissionError, readBytes, removePhotos, signPhotos, type PreparedPhoto } from './place-photo';
import { supabase } from './supabase';

export { ALBUM_BUCKET };

/** Full-size photos are at most this many pixels on their long edge. */
export const ALBUM_MAX_EDGE = 2048;
export const ALBUM_THUMB_WIDTH = 512;
const FULL_QUALITY = 0.8;
const THUMB_QUALITY = 0.7;
/** How many photos one pick can add. */
export const ALBUM_PICK_LIMIT = 10;
/** Grid tiles are this tall at most / at least, whatever the photo's shape. */
export const TILE_MIN = 110;
export const TILE_MAX = 200;

export type AlbumPhoto = {
  id: string;
  trip_id: string;
  uploaded_by: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  taken_on: Day;
  created_at: string;
  /** A signed link to the thumbnail; null if it couldn't be signed. */
  thumbUrl: string | null;
};

export type PickedPhoto = { uri: string; takenOn: Day };

const EXIF_DATE = /^(\d{4})[:-](\d{2})[:-](\d{2})/;

/**
 * The day a photo was taken, from its EXIF data: DateTimeOriginal "2026:11:27 14:03:11" -> "2026-11-27".
 * iOS nests the tags under "{Exif}" / "{TIFF}"; Android puts them at the top level.
 */
export function exifDay(exif?: Record<string, unknown> | null): Day | null {
  if (!exif) return null;
  const nested = (key: string) => (exif[key] && typeof exif[key] === 'object' ? (exif[key] as Record<string, unknown>) : {});
  const candidates = [
    exif.DateTimeOriginal,
    nested('{Exif}').DateTimeOriginal,
    exif.DateTimeDigitized,
    nested('{Exif}').DateTimeDigitized,
    exif.DateTime,
    nested('{TIFF}').DateTime,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const m = c.match(EXIF_DATE);
    if (!m) continue;
    const [, y, mo, d] = m.map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (y > 1900 && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/**
 * Lets the person choose up to 10 photos from their library, or take one. Returns [] if they cancel and
 * throws `PhotoPermissionError` when the camera isn't allowed. Photos without a date are dated today.
 */
export async function pickAlbumPhotos(from: 'library' | 'camera'): Promise<PickedPhoto[]> {
  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PhotoPermissionError();
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: true,
    ...(from === 'library' ? { allowsMultipleSelection: true, selectionLimit: ALBUM_PICK_LIMIT, orderedSelection: true } : {}),
  };
  const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, ALBUM_PICK_LIMIT).map((a) => ({ uri: a.uri, takenOn: exifDay(a.exif) ?? today() }));
}

/** The size that fits `width` x `height` inside a `max` x `max` box, never larger than the original. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Re-encodes a photo as JPEG (which drops its EXIF and GPS data): the full photo with its long edge at
 * most 2048px, and a 512px-wide thumbnail for the grid. Runs off the JS thread.
 */
export async function prepareAlbumPhoto(uri: string): Promise<{ full: PreparedPhoto; thumb: PreparedPhoto }> {
  // Decoding first gives the real size after EXIF rotation.
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const fullSize = fitWithin(original.width, original.height, ALBUM_MAX_EDGE);
  const thumbScale = Math.min(1, ALBUM_THUMB_WIDTH / original.width);
  const thumbSize = { width: Math.max(1, Math.round(original.width * thumbScale)), height: Math.max(1, Math.round(original.height * thumbScale)) };

  const full = await (await ImageManipulator.manipulate(original).resize(fullSize).renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: FULL_QUALITY,
  });
  const thumb = await (await ImageManipulator.manipulate(original).resize(thumbSize).renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: THUMB_QUALITY,
  });
  return {
    full: { uri: full.uri, width: fullSize.width, height: fullSize.height },
    thumb: { uri: thumb.uri, width: thumbSize.width, height: thumbSize.height },
  };
}

export function albumPaths(tripId: string, photoId: string) {
  return { path: `${tripId}/${photoId}.jpg`, thumb_path: `${tripId}/${photoId}-thumb.jpg` };
}

async function upload(path: string, uri: string) {
  const { error } = await supabase.storage.from(ALBUM_BUCKET).upload(path, await readBytes(uri), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
}

/**
 * Adds one photo to the album: uploads the full photo, then the thumbnail, then saves the row.
 * If any step fails, removes whatever was uploaded and throws. Returns the photo id.
 */
export async function addAlbumPhoto(tripId: string, p: PickedPhoto): Promise<string> {
  const { full, thumb } = await prepareAlbumPhoto(p.uri);
  // The database compares the path with the lower-case uuid text, so keep the id lower case.
  const id = randomUUID().toLowerCase();
  const { path, thumb_path } = albumPaths(tripId, id);
  const uploaded: string[] = [];
  try {
    await upload(path, full.uri);
    uploaded.push(path);
    await upload(thumb_path, thumb.uri);
    uploaded.push(thumb_path);
    const { error } = await supabase
      .from('trip_photos')
      .insert({ id, trip_id: tripId, path, thumb_path, width: full.width, height: full.height, taken_on: p.takenOn });
    if (error) throw error;
  } catch (e) {
    await removePhotos(uploaded, ALBUM_BUCKET).catch(() => {});
    throw e;
  }
  return id;
}

/** Deletes the photo's row, then its files (best effort: a leftover file is only visible to members). */
export async function deleteAlbumPhoto(photo: Pick<AlbumPhoto, 'id' | 'path' | 'thumb_path'>): Promise<void> {
  const { data, error } = await supabase.from('trip_photos').delete().eq('id', photo.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not deleted');
  await removePhotos([photo.path, photo.thumb_path], ALBUM_BUCKET).catch(() => {});
}

/** Which day of the trip a photo is from (1-based), or null outside the trip's dates or without dates. */
export function dayIndex(takenOn: Day, start: Day | null, end: Day | null): number | null {
  if (!start || !end || takenOn < start || takenOn > end) return null;
  return nightsBetween(start, takenOn) + 1;
}

export type AlbumChip = 'all' | 'mine' | number;

/** All, then "Day N" only for days that have photos, then Mine. */
export function filterChips(photos: Pick<AlbumPhoto, 'taken_on'>[], dates: { start: Day; end: Day } | null): AlbumChip[] {
  const days = new Set<number>();
  if (dates) {
    for (const p of photos) {
      const n = dayIndex(p.taken_on, dates.start, dates.end);
      if (n !== null) days.add(n);
    }
  }
  return ['all', ...[...days].sort((a, b) => a - b), 'mine'];
}

/** The photos a chip shows. */
export function filterPhotos<T extends Pick<AlbumPhoto, 'taken_on' | 'uploaded_by'>>(
  photos: T[],
  chip: AlbumChip,
  me: string | undefined,
  dates: { start: Day; end: Day } | null,
): T[] {
  if (chip === 'all') return photos;
  if (chip === 'mine') return photos.filter((p) => p.uploaded_by === me);
  return photos.filter((p) => dates && dayIndex(p.taken_on, dates.start, dates.end) === chip);
}

/** "Zoe · Day 2", or just "Zoe" outside the dates; my photos say "You". */
export function photoCaption(
  photo: Pick<AlbumPhoto, 'taken_on' | 'uploaded_by'>,
  me: string | undefined,
  names: Map<string, string>,
  dates: { start: Day; end: Day } | null,
): string {
  const who = photo.uploaded_by === me ? 'You' : (names.get(photo.uploaded_by) ?? 'Someone');
  const n = dates ? dayIndex(photo.taken_on, dates.start, dates.end) : null;
  return n === null ? who : `${who} · Day ${n}`;
}

/**
 * Pip's line under the album:
 * "No photos yet. Add the first and everyone gets the full album." /
 * "Lena hasn't added any photos yet. Everyone gets the full album." / "Lena and Arjun haven't…" /
 * "Lena, Arjun and 2 more haven't…" / "Everyone's added photos. 24 and counting."
 * Pass `me` to say "You" instead of my name.
 */
export function missingLine(memberIds: string[], photos: Pick<AlbumPhoto, 'uploaded_by'>[], names: Map<string, string>, me?: string): string {
  if (!photos.length) return 'No photos yet. Add the first and everyone gets the full album.';
  const added = new Set(photos.map((p) => p.uploaded_by));
  const missing = memberIds.filter((id) => !added.has(id));
  if (!missing.length) return `Everyone's added photos. ${photos.length} and counting.`;
  // "You" first reads better than in the middle of a list.
  missing.sort((a, b) => Number(b === me) - Number(a === me));
  const label = (id: string) => (id === me ? 'You' : (names.get(id) ?? 'Someone'));
  const who =
    missing.length === 1
      ? label(missing[0])
      : missing.length === 2
        ? `${label(missing[0])} and ${label(missing[1])}`
        : `${label(missing[0])}, ${label(missing[1])} and ${missing.length - 2} more`;
  const verb = missing.length === 1 && missing[0] !== me ? "hasn't" : "haven't";
  return `${who} ${verb} added any photos yet. Everyone gets the full album.`;
}

/**
 * Lays photos out in two columns: each goes in the shorter column (left on a tie), with a height that
 * keeps its shape at `colWidth`, clamped to 110..200. `shorter` is where the "Add yours" tile goes.
 */
export function masonry<T extends { width: number; height: number }>(
  items: T[],
  colWidth: number,
  gap = 0,
): { left: (T & { h: number })[]; right: (T & { h: number })[]; shorter: 'left' | 'right' } {
  const left: (T & { h: number })[] = [];
  const right: (T & { h: number })[] = [];
  let lh = 0;
  let rh = 0;
  for (const item of items) {
    const ratio = item.width > 0 ? item.height / item.width : 1;
    const h = Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(colWidth * ratio)));
    if (lh <= rh) {
      left.push({ ...item, h });
      lh += h + gap;
    } else {
      right.push({ ...item, h });
      rh += h + gap;
    }
  }
  return { left, right, shorter: lh <= rh ? 'left' : 'right' };
}

const ALBUM_COLUMNS = 'id, trip_id, uploaded_by, path, thumb_path, width, height, taken_on, created_at';

/** The trip's album, oldest day first, with signed thumbnail links. */
export function useAlbum(tripId?: string) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('trip_photos')
      .select(ALBUM_COLUMNS)
      .eq('trip_id', tripId)
      .order('taken_on')
      .order('created_at');
    setError(error ? "Couldn't load the photos. Check your connection and try again." : null);
    if (!error) {
      const rows = (data ?? []) as Omit<AlbumPhoto, 'thumbUrl'>[];
      const signed = await signPhotos(
        rows.map((r) => r.thumb_path),
        ALBUM_BUCKET,
      );
      setPhotos(rows.map((r) => ({ ...r, thumbUrl: signed.get(r.thumb_path) ?? null })));
    }
    setLoading(false);
  }, [tripId]);

  return { photos, loading, error, refresh };
}

/** Signed links to full-size photos, for the viewer. */
export function signFull(paths: string[]): Promise<Map<string, string>> {
  return signPhotos(paths, ALBUM_BUCKET);
}
