import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Every place photo is stored at this size, so cards and covers always crop the same way. */
export const PHOTO_WIDTH = 1600;
export const PHOTO_HEIGHT = 900;
const PHOTO_QUALITY = 0.75;
export const PHOTO_BUCKET = 'place-photos';
/** How long a signed photo link works. expo-image keys its cache on the path, so a new link doesn't re-download. */
const SIGNED_URL_SECONDS = 60 * 60;

export type PreparedPhoto = { uri: string; width: number; height: number };

/** The largest centred 16:9 rectangle that fits inside a `width` x `height` image. */
export function cropRect(width: number, height: number) {
  const target = PHOTO_WIDTH / PHOTO_HEIGHT;
  if (width / height > target) {
    const w = Math.round(height * target);
    return { originX: Math.floor((width - w) / 2), originY: 0, width: w, height };
  }
  const h = Math.round(width / target);
  return { originX: 0, originY: Math.floor((height - h) / 2), width, height: h };
}

/**
 * Lets the person choose a photo from their library or take one. Returns null if they cancel, or
 * throws `PhotoPermissionError` when the camera isn't allowed.
 */
export async function pickPhoto(from: 'library' | 'camera'): Promise<string | null> {
  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PhotoPermissionError();
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

export class PhotoPermissionError extends Error {
  constructor() {
    super('Camera permission denied');
  }
}

/** Crops the middle 16:9 of a photo and resizes it to 1600x900 JPEG. Runs off the JS thread. */
export async function preparePhoto(uri: string): Promise<PreparedPhoto> {
  // Decoding first gives the real size after EXIF rotation; the picker's width/height can be 0 or unrotated.
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const rendered = await ImageManipulator.manipulate(original)
    .crop(cropRect(original.width, original.height))
    .resize({ width: PHOTO_WIDTH, height: PHOTO_HEIGHT })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export function photoPath(tripId: string, destinationId: string) {
  return `${tripId}/${destinationId}.jpg`;
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/** Uploads a prepared photo and returns its path in the bucket. */
export async function uploadPhoto(tripId: string, destinationId: string, uri: string): Promise<string> {
  const path = photoPath(tripId, destinationId);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, await readBytes(uri), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Removes photos from the bucket. Best effort: a leftover photo is only visible to the trip's members. */
export async function removePhotos(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}

/** Short-lived links for photos, by path. Paths that can't be signed are left out. */
export async function signPhotos(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (!unique.length) return urls;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error || !data) return urls;
  for (const row of data) if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
  return urls;
}

// --- Copies on the device ---------------------------------------------------------------------------
// Native only (web has no file system; the browser cache does this job there). Laid out as
//   <documents>/huddle/trips/<trip_id>/places/<destination_id>.jpg
// so a whole trip's photos can be cleared together.

const canStoreLocally = () => Platform.OS !== 'web';

function huddleDir() {
  return new Directory(Paths.document, 'huddle');
}

function tripDir(tripId: string) {
  return new Directory(huddleDir(), 'trips', tripId);
}

function localFile(tripId: string, destinationId: string) {
  return new File(tripDir(tripId), 'places', `${destinationId}.jpg`);
}

/** The device copy of a place's photo, if there is one. */
export function localPhotoUri(tripId: string, destinationId: string): string | null {
  if (!canStoreLocally()) return null;
  try {
    const file = localFile(tripId, destinationId);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Copies a photo into the Huddle folder on the device. Never throws: the upload is what matters. */
export function keepLocalCopy(tripId: string, destinationId: string, uri: string) {
  if (!canStoreLocally()) return;
  try {
    const target = localFile(tripId, destinationId);
    target.parentDirectory.create({ intermediates: true, idempotent: true });
    new File(uri).copy(target);
  } catch {
    // Out of space or similar; the photo still loads from Supabase.
  }
}

const downloading = new Set<string>();

/** Saves another member's photo into the Huddle folder in the background, once. */
export async function downloadLocalCopy(tripId: string, destinationId: string, url: string) {
  if (!canStoreLocally() || downloading.has(destinationId) || localPhotoUri(tripId, destinationId)) return;
  downloading.add(destinationId);
  try {
    const target = localFile(tripId, destinationId);
    target.parentDirectory.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(url, target);
  } catch {
    // Offline or the link expired; try again next time the photo is shown.
  } finally {
    downloading.delete(destinationId);
  }
}

export function deleteLocalCopy(tripId: string, destinationId: string) {
  if (!canStoreLocally()) return;
  try {
    const file = localFile(tripId, destinationId);
    if (file.exists) file.delete();
  } catch {
    // Nothing to clean up.
  }
}

/** Removes every photo kept for a trip, e.g. after leaving or deleting it. */
export function deleteLocalTrip(tripId: string) {
  if (!canStoreLocally()) return;
  try {
    const dir = tripDir(tripId);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to clean up.
  }
}
