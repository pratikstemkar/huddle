import { act, renderHook } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { PhotoPermissionError } from '@/lib/place-photo';
import {
  addAlbumPhoto,
  ALBUM_BUCKET,
  dayIndex,
  deleteAlbumPhoto,
  exifDay,
  filterChips,
  filterPhotos,
  fitWithin,
  masonry,
  missingLine,
  photoCaption,
  pickAlbumPhotos,
  prepareAlbumPhoto,
  signFull,
  useAlbum,
  type AlbumPhoto,
} from '@/lib/trip-photos';
import { photoState } from '../../test-utils/photo-mocks';
import { queriesFor, queueResult, storageCallsFor } from '../../test-utils/supabase-mock';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'ABCDEF12-2222-3333-4444-555555555555' }));

const TRIP = 'aaaaaaaa-0000-0000-0000-000000000001';
const PHOTO_ID = 'abcdef12-2222-3333-4444-555555555555';
const DATES = { start: '2027-03-12', end: '2027-03-14' };

function photo(overrides: Partial<AlbumPhoto> = {}): AlbumPhoto {
  return {
    id: 'p1',
    trip_id: TRIP,
    uploaded_by: 'zoe',
    path: `${TRIP}/p1.jpg`,
    thumb_path: `${TRIP}/p1-thumb.jpg`,
    width: 1600,
    height: 1200,
    taken_on: '2027-03-13',
    created_at: '2027-03-13T10:00:00Z',
    thumbUrl: null,
    ...overrides,
  };
}

describe('exifDay', () => {
  it('reads DateTimeOriginal', () => {
    expect(exifDay({ DateTimeOriginal: '2026:11:27 14:03:11' })).toBe('2026-11-27');
  });

  it('reads the tags iOS nests', () => {
    expect(exifDay({ '{Exif}': { DateTimeOriginal: '2026:11:27 14:03:11' } })).toBe('2026-11-27');
    expect(exifDay({ '{TIFF}': { DateTime: '2026:01:02 00:00:00' } })).toBe('2026-01-02');
  });

  it('prefers the original date, then digitised, then the file date', () => {
    expect(exifDay({ DateTime: '2026:01:03 00:00:00', DateTimeDigitized: '2026:01:02 00:00:00', DateTimeOriginal: '2026:01:01 00:00:00' })).toBe('2026-01-01');
    expect(exifDay({ DateTime: '2026:01:03 00:00:00', DateTimeDigitized: '2026:01:02 00:00:00' })).toBe('2026-01-02');
    expect(exifDay({ DateTime: '2026:01:03 00:00:00' })).toBe('2026-01-03');
  });

  it('skips dates that are blank or impossible', () => {
    expect(exifDay({ DateTimeOriginal: '0000:00:00 00:00:00', DateTime: '2026:02:03 00:00:00' })).toBe('2026-02-03');
    expect(exifDay({ DateTimeOriginal: '2026:02:30 00:00:00' })).toBeNull();
    expect(exifDay({ DateTimeOriginal: 'yesterday' })).toBeNull();
    expect(exifDay({ DateTimeOriginal: 20261127 })).toBeNull();
  });

  it('is null without EXIF', () => {
    expect(exifDay(undefined)).toBeNull();
    expect(exifDay(null)).toBeNull();
    expect(exifDay({})).toBeNull();
  });
});

describe('pickAlbumPhotos', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'queueMicrotask'] });
    jest.setSystemTime(new Date(2027, 2, 20, 12));
  });
  afterEach(() => jest.useRealTimers());

  it('picks up to 10 photos from the library with their EXIF', async () => {
    photoState.pickerResult = {
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', width: 10, height: 10, exif: { DateTimeOriginal: '2027:03:13 09:00:00' } },
        { uri: 'file:///b.jpg', width: 10, height: 10, exif: null },
      ],
    };
    await expect(pickAlbumPhotos('library')).resolves.toEqual([
      { uri: 'file:///a.jpg', takenOn: '2027-03-13' },
      { uri: 'file:///b.jpg', takenOn: '2027-03-20' },
    ]);
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 1,
      exif: true,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      orderedSelection: true,
    });
  });

  it('never returns more than 10', async () => {
    photoState.pickerResult = { canceled: false, assets: Array.from({ length: 12 }, (_, i) => ({ uri: `file:///${i}.jpg`, width: 1, height: 1 })) };
    await expect(pickAlbumPhotos('library')).resolves.toHaveLength(10);
  });

  it('returns nothing when cancelled', async () => {
    await expect(pickAlbumPhotos('library')).resolves.toEqual([]);
  });

  it('takes one photo with the camera once allowed', async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///c.jpg', width: 1, height: 1 }] };
    await expect(pickAlbumPhotos('camera')).resolves.toEqual([{ uri: 'file:///c.jpg', takenOn: '2027-03-20' }]);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1, exif: true });
  });

  it('throws when the camera is not allowed', async () => {
    photoState.cameraGranted = false;
    await expect(pickAlbumPhotos('camera')).rejects.toBeInstanceOf(PhotoPermissionError);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});

describe('fitWithin', () => {
  it('shrinks the long edge to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it('never makes a small photo bigger', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});

describe('prepareAlbumPhoto', () => {
  it('makes a full photo of at most 2048px and a 512px-wide thumbnail, both JPEG', async () => {
    const { full, thumb } = await prepareAlbumPhoto('file:///pick.heic');
    expect(full).toEqual({ uri: 'file:///cache/prepared.jpg', width: 2048, height: 1536 });
    expect(thumb).toEqual({ uri: 'file:///cache/prepared-2.jpg', width: 512, height: 384 });
    expect(photoState.actions).toEqual([
      ['resize', { width: 2048, height: 1536 }],
      ['save', { format: 'jpeg', compress: 0.8 }],
      ['resize', { width: 512, height: 384 }],
      ['save', { format: 'jpeg', compress: 0.7 }],
    ]);
  });

  it("doesn't enlarge a small photo", async () => {
    photoState.decodedSize = { width: 400, height: 300 };
    const { full, thumb } = await prepareAlbumPhoto('file:///small.jpg');
    expect(full).toMatchObject({ width: 400, height: 300 });
    expect(thumb).toMatchObject({ width: 400, height: 300 });
  });

  it('throws when the photo cannot be read', async () => {
    photoState.failDecode = true;
    await expect(prepareAlbumPhoto('file:///bad.jpg')).rejects.toThrow('decode failed');
  });
});

describe('addAlbumPhoto', () => {
  const picked = { uri: 'file:///a.jpg', takenOn: '2027-03-13' };

  it('uploads the photo, then the thumbnail, then saves the row', async () => {
    await expect(addAlbumPhoto(TRIP, picked)).resolves.toBe(PHOTO_ID);
    expect(storageCallsFor('upload').map((c) => [c.bucket, c.args[0], c.args[2]])).toEqual([
      [ALBUM_BUCKET, `${TRIP}/${PHOTO_ID}.jpg`, { contentType: 'image/jpeg', upsert: false }],
      [ALBUM_BUCKET, `${TRIP}/${PHOTO_ID}-thumb.jpg`, { contentType: 'image/jpeg', upsert: false }],
    ]);
    expect(queriesFor('trip_photos')[0].ops).toEqual([
      [
        'insert',
        [
          {
            id: PHOTO_ID,
            trip_id: TRIP,
            path: `${TRIP}/${PHOTO_ID}.jpg`,
            thumb_path: `${TRIP}/${PHOTO_ID}-thumb.jpg`,
            width: 2048,
            height: 1536,
            taken_on: '2027-03-13',
          },
        ],
      ],
    ]);
    expect(storageCallsFor('remove')).toHaveLength(0);
  });

  it('removes both files when saving the row fails', async () => {
    queueResult('trip_photos', { error: { message: 'new row violates row-level security policy' } });
    await expect(addAlbumPhoto(TRIP, picked)).rejects.toEqual({ message: 'new row violates row-level security policy' });
    expect(storageCallsFor('remove')[0]).toMatchObject({ bucket: ALBUM_BUCKET, args: [[`${TRIP}/${PHOTO_ID}.jpg`, `${TRIP}/${PHOTO_ID}-thumb.jpg`]] });
  });

  it('removes the full photo when the thumbnail upload fails, and saves no row', async () => {
    queueResult('storage:upload', { data: {} }, { error: { message: 'offline' } });
    await expect(addAlbumPhoto(TRIP, picked)).rejects.toEqual({ message: 'offline' });
    expect(storageCallsFor('remove')[0].args[0]).toEqual([`${TRIP}/${PHOTO_ID}.jpg`]);
    expect(queriesFor('trip_photos')).toHaveLength(0);
  });

  it('removes nothing when the first upload fails', async () => {
    queueResult('storage:upload', { error: { message: 'too large' } });
    await expect(addAlbumPhoto(TRIP, picked)).rejects.toEqual({ message: 'too large' });
    expect(storageCallsFor('upload')).toHaveLength(1);
    expect(storageCallsFor('remove')).toHaveLength(0);
  });

  it('still throws the original error when the clean-up fails too', async () => {
    queueResult('trip_photos', { error: { message: 'offline' } });
    queueResult('storage:remove', { error: { message: 'also offline' } });
    await expect(addAlbumPhoto(TRIP, picked)).rejects.toEqual({ message: 'offline' });
  });
});

describe('deleteAlbumPhoto', () => {
  it('deletes the row, then both files', async () => {
    queueResult('trip_photos', { data: [{ id: 'p1' }] });
    await deleteAlbumPhoto(photo());
    expect(queriesFor('trip_photos')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['id', 'p1']],
      ['select', ['id']],
    ]);
    expect(storageCallsFor('remove')[0]).toMatchObject({ bucket: ALBUM_BUCKET, args: [[`${TRIP}/p1.jpg`, `${TRIP}/p1-thumb.jpg`]] });
  });

  it("keeps the files when the row couldn't be deleted", async () => {
    queueResult('trip_photos', { data: [] });
    await expect(deleteAlbumPhoto(photo())).rejects.toThrow('Not deleted');
    expect(storageCallsFor('remove')).toHaveLength(0);
  });

  it('throws the database error', async () => {
    queueResult('trip_photos', { error: { message: 'offline' } });
    await expect(deleteAlbumPhoto(photo())).rejects.toEqual({ message: 'offline' });
  });

  it("doesn't fail when the files can't be removed", async () => {
    queueResult('trip_photos', { data: [{ id: 'p1' }] });
    queueResult('storage:remove', { error: { message: 'offline' } });
    await expect(deleteAlbumPhoto(photo())).resolves.toBeUndefined();
  });
});

describe('dayIndex', () => {
  it('numbers the trip days from 1', () => {
    expect(dayIndex('2027-03-12', DATES.start, DATES.end)).toBe(1);
    expect(dayIndex('2027-03-14', DATES.start, DATES.end)).toBe(3);
  });

  it('is null outside the dates or without dates', () => {
    expect(dayIndex('2027-03-11', DATES.start, DATES.end)).toBeNull();
    expect(dayIndex('2027-03-15', DATES.start, DATES.end)).toBeNull();
    expect(dayIndex('2027-03-12', null, null)).toBeNull();
  });
});

describe('filterChips', () => {
  it('lists All, the days that have photos, then Mine', () => {
    const photos = [photo({ taken_on: '2027-03-14' }), photo({ taken_on: '2027-03-12' }), photo({ taken_on: '2027-03-14' }), photo({ taken_on: '2027-04-01' })];
    expect(filterChips(photos, DATES)).toEqual(['all', 1, 3, 'mine']);
  });

  it('has only All and Mine without dates', () => {
    expect(filterChips([photo()], null)).toEqual(['all', 'mine']);
  });
});

describe('filterPhotos', () => {
  const photos = [photo({ id: 'a', uploaded_by: 'me', taken_on: '2027-03-12' }), photo({ id: 'b', taken_on: '2027-03-13' }), photo({ id: 'c', taken_on: '2027-04-01' })];

  it('shows all, mine or one day', () => {
    expect(filterPhotos(photos, 'all', 'me', DATES).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(filterPhotos(photos, 'mine', 'me', DATES).map((p) => p.id)).toEqual(['a']);
    expect(filterPhotos(photos, 2, 'me', DATES).map((p) => p.id)).toEqual(['b']);
    expect(filterPhotos(photos, 2, 'me', null)).toEqual([]);
  });
});

describe('photoCaption', () => {
  const names = new Map([['zoe', 'Zoe']]);

  it('names who added it and the trip day', () => {
    expect(photoCaption(photo(), 'me', names, DATES)).toBe('Zoe · Day 2');
    expect(photoCaption(photo({ uploaded_by: 'me' }), 'me', names, DATES)).toBe('You · Day 2');
  });

  it('leaves the day out off the dates or without dates', () => {
    expect(photoCaption(photo({ taken_on: '2027-04-01' }), 'me', names, DATES)).toBe('Zoe');
    expect(photoCaption(photo(), 'me', names, null)).toBe('Zoe');
    expect(photoCaption(photo({ uploaded_by: 'gone' }), 'me', names, null)).toBe('Someone');
  });
});

describe('missingLine', () => {
  const names = new Map([
    ['lena', 'Lena'],
    ['arjun', 'Arjun'],
    ['zoe', 'Zoe'],
    ['kai', 'Kai'],
    ['me', 'Maya'],
  ]);

  it('invites the first photo', () => {
    expect(missingLine(['lena', 'zoe'], [], names)).toBe('No photos yet. Add the first and everyone gets the full album.');
  });

  it('names who has not added photos', () => {
    const photos = [photo({ uploaded_by: 'zoe' })];
    expect(missingLine(['zoe', 'lena'], photos, names)).toBe("Lena hasn't added any photos yet. Everyone gets the full album.");
    expect(missingLine(['zoe', 'lena', 'arjun'], photos, names)).toBe("Lena and Arjun haven't added any photos yet. Everyone gets the full album.");
    expect(missingLine(['zoe', 'lena', 'arjun', 'kai', 'me'], photos, names)).toBe(
      "Lena, Arjun and 2 more haven't added any photos yet. Everyone gets the full album.",
    );
  });

  it('says You for me, first', () => {
    const photos = [photo({ uploaded_by: 'zoe' })];
    expect(missingLine(['zoe', 'me'], photos, names, 'me')).toBe("You haven't added any photos yet. Everyone gets the full album.");
    expect(missingLine(['zoe', 'lena', 'me'], photos, names, 'me')).toBe("You and Lena haven't added any photos yet. Everyone gets the full album.");
  });

  it('counts the album when everyone has added photos', () => {
    const photos = [photo({ uploaded_by: 'zoe' }), photo({ uploaded_by: 'lena' }), photo({ uploaded_by: 'gone' })];
    expect(missingLine(['zoe', 'lena'], photos, names)).toBe("Everyone's added photos. 3 and counting.");
  });
});

describe('masonry', () => {
  it('keeps each photo’s shape at the column width, clamped to 110..200', () => {
    const { left, right } = masonry(
      [
        { width: 100, height: 100 },
        { width: 100, height: 300 },
        { width: 300, height: 100 },
      ],
      150,
    );
    expect(left.map((x) => x.h)).toEqual([150, 110]);
    expect(right.map((x) => x.h)).toEqual([200]);
  });

  it('puts each photo in the shorter column, left on a tie, and says which ends shorter', () => {
    const tall = { width: 100, height: 200 };
    const short = { width: 100, height: 110 };
    const result = masonry([tall, short, short, short], 100);
    // left 200 | right 110 -> right 220 -> left 310: the right column ends shorter.
    expect(result.left.map((x) => x.h)).toEqual([200, 110]);
    expect(result.right.map((x) => x.h)).toEqual([110, 110]);
    expect(result.shorter).toBe('right');
  });

  it('copes with nothing and with a zero width', () => {
    expect(masonry([], 150)).toEqual({ left: [], right: [], shorter: 'left' });
    expect(masonry([{ width: 0, height: 0 }], 150).left[0].h).toBe(150);
  });

  it('adds the gap between tiles when balancing', () => {
    const result = masonry(
      [
        { width: 100, height: 200 },
        { width: 100, height: 190 },
        { width: 100, height: 110 },
      ],
      100,
      20,
    );
    // left 220, right 210 -> the third goes right
    expect(result.right).toHaveLength(2);
  });
});

describe('useAlbum', () => {
  it("loads the album in day order with signed thumbnails", async () => {
    queueResult('trip_photos', { data: [photo({ thumbUrl: undefined } as Partial<AlbumPhoto>), photo({ id: 'p2', thumb_path: `${TRIP}/p2-thumb.jpg` })] });
    queueResult('storage:createSignedUrls', { data: [{ path: `${TRIP}/p1-thumb.jpg`, signedUrl: 'https://signed/p1' }] });
    const { result } = await renderHook(() => useAlbum(TRIP));
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());
    expect(result.current.photos.map((p) => [p.id, p.thumbUrl])).toEqual([
      ['p1', 'https://signed/p1'],
      ['p2', null],
    ]);
    expect(storageCallsFor('createSignedUrls')[0]).toMatchObject({ bucket: ALBUM_BUCKET });
    expect(queriesFor('trip_photos')[0].ops).toEqual([
      ['select', ['id, trip_id, uploaded_by, path, thumb_path, width, height, taken_on, created_at']],
      ['eq', ['trip_id', TRIP]],
      ['order', ['taken_on']],
      ['order', ['created_at']],
    ]);
  });

  it('keeps the last album and shows an error when loading fails', async () => {
    queueResult('trip_photos', { data: [photo()] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useAlbum(TRIP));
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.error).toBe("Couldn't load the photos. Check your connection and try again.");
  });

  it('does nothing without a trip', async () => {
    const { result } = await renderHook(() => useAlbum(undefined));
    await act(() => result.current.refresh());
    expect(queriesFor('trip_photos')).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});

describe('signFull', () => {
  it('signs full-size photos in the album bucket', async () => {
    queueResult('storage:createSignedUrls', { data: [{ path: 'a.jpg', signedUrl: 'https://s/a' }] });
    const urls = await signFull(['a.jpg']);
    expect(urls.get('a.jpg')).toBe('https://s/a');
    expect(storageCallsFor('createSignedUrls')[0].bucket).toBe(ALBUM_BUCKET);
  });
});
