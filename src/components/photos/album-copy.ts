import { formatDay, type Day } from '@/lib/dates';
import { photoCaption, type AlbumChip, type AlbumPhoto } from '@/lib/trip-photos';

/** "Goa getaway · 24 photos from 4 people", "… · 1 photo from 1 person", or "… · No photos yet". */
export function albumHeader(tripName: string, photos: Pick<AlbumPhoto, 'uploaded_by'>[]): string {
  if (!photos.length) return `${tripName} · No photos yet`;
  const people = new Set(photos.map((p) => p.uploaded_by)).size;
  const count = `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`;
  return `${tripName} · ${count} from ${people} ${people === 1 ? 'person' : 'people'}`;
}

export function chipLabel(chip: AlbumChip): string {
  if (chip === 'all') return 'All';
  if (chip === 'mine') return 'Mine';
  return `Day ${chip}`;
}

/** The chip as a route param, and back. Unknown values fall back to All. */
export function chipParam(chip: AlbumChip): string {
  return String(chip);
}
export function parseChip(value: string | undefined): AlbumChip {
  if (value === 'mine') return 'mine';
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 'all';
}

/** The viewer's caption: "Zoe · Day 2 · 27 Nov", or "Zoe · 27 Nov" outside the trip's dates. */
export function viewerCaption(
  photo: Pick<AlbumPhoto, 'taken_on' | 'uploaded_by'>,
  me: string | undefined,
  names: Map<string, string>,
  dates: { start: Day; end: Day } | null,
): string {
  return `${photoCaption(photo, me, names, dates)} · ${formatDay(photo.taken_on, { day: 'numeric', month: 'short' })}`;
}
