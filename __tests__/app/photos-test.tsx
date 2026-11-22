import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import type { AlbumPhoto } from '@/lib/trip-photos';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, members, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), useTrip: () => mockState }));

let mockAlbum: { photos: AlbumPhoto[]; loading: boolean; error: string | null; refresh: jest.Mock };
jest.mock('@/lib/trip-photos', () => ({
  ...jest.requireActual('@/lib/trip-photos'),
  useAlbum: () => mockAlbum,
  pickAlbumPhotos: jest.fn(),
  addAlbumPhoto: jest.fn(),
}));

let mockPip: { label: string; onPress: () => void } | null = null;
jest.mock('@/components/nav/pip-action', () => ({
  useRegisterPipAction: (label: string, onPress: () => void) => {
    mockPip = { label, onPress };
  },
}));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const { pickAlbumPhotos, addAlbumPhoto } = require('@/lib/trip-photos') as { pickAlbumPhotos: jest.Mock; addAlbumPhoto: jest.Mock };
const PhotosTab = require('@/app/(app)/trip/[id]/(tabs)/photos').default as () => React.JSX.Element;

const KABIR = 'kabir-id';
const crew = [...members, { ...members[1], user_id: KABIR, display_name: 'Kabir' }];
const dated = trip({ name: 'Goa getaway', members: crew, locked_start: '2027-03-01', locked_end: '2027-03-03', status: 'locked' });

function photo(overrides: Partial<AlbumPhoto> = {}): AlbumPhoto {
  const id = overrides.id ?? 'p1';
  return {
    id,
    trip_id: TRIP_ID,
    uploaded_by: MEMBER,
    path: `${TRIP_ID}/${id}.jpg`,
    thumb_path: `${TRIP_ID}/${id}-thumb.jpg`,
    width: 1200,
    height: 1600,
    taken_on: '2027-03-02',
    created_at: '2027-03-02T10:00:00Z',
    thumbUrl: `https://signed/${id}`,
    ...overrides,
  };
}

const ALBUM = [
  photo({ id: 'p1', uploaded_by: MEMBER, taken_on: '2027-03-02' }),
  photo({ id: 'p2', uploaded_by: ORGANISER, taken_on: '2027-03-01' }),
  photo({ id: 'p3', uploaded_by: MEMBER, taken_on: '2027-02-20' }),
];

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

describe('Photos tab', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(dated);
    mockAlbum = { photos: ALBUM, loading: false, error: null, refresh: jest.fn() };
    mockPip = null;
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alert.mockRestore());

  it('loads on focus and follows live album changes', async () => {
    await render(<PhotosTab />);
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockAlbum.refresh).toHaveBeenCalled();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, expect.any(Function), ['trip_photos', 'trip_members', 'trips']);
  });

  it('counts photos and people in the header', async () => {
    await render(<PhotosTab />);
    expect(screen.getByText('Goa getaway · 3 photos from 2 people')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
  });

  it('uses singular forms for one photo', async () => {
    mockAlbum.photos = [ALBUM[0]];
    await render(<PhotosTab />);
    expect(screen.getByText('Goa getaway · 1 photo from 1 person')).toBeTruthy();
  });

  it('captions tiles with who and which day', async () => {
    await render(<PhotosTab />);
    expect(screen.getByText('Meera · Day 2')).toBeTruthy();
    expect(screen.getByText('You · Day 1')).toBeTruthy();
    // Outside the trip's dates: just the name.
    expect(screen.getByText('Meera')).toBeTruthy();
  });

  it('filters by day and by mine, with the selected chip marked', async () => {
    await render(<PhotosTab />);
    const chips = ['All', 'Day 1', 'Day 2', 'Mine'].map((name) => screen.getByRole('button', { name }));
    expect(chips[0]).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Day 2' }));
    expect(screen.getByText('Meera · Day 2')).toBeTruthy();
    expect(screen.queryByText('You · Day 1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Day 2' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Mine' }));
    expect(screen.getByText('You · Day 1')).toBeTruthy();
    expect(screen.queryByText('Meera · Day 2')).toBeNull();
  });

  it('shows only All and Mine without trip dates', async () => {
    mockState = tripState(trip({ name: 'Goa getaway', members: crew }));
    await render(<PhotosTab />);
    expect(screen.queryByRole('button', { name: 'Day 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mine' })).toBeTruthy();
    expect(screen.getAllByText('Meera')).toHaveLength(2);
  });

  it('opens the viewer with the current filter', async () => {
    await render(<PhotosTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Day 2' }));
    await fireEvent.press(screen.getByLabelText('Photo, Meera · Day 2'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/photo/[photoId]', params: { id: TRIP_ID, photoId: 'p1', filter: '2' } });
  });

  it('has Pip name who has not added photos', async () => {
    await render(<PhotosTab />);
    expect(screen.getByText(/Kabir hasn't added any photos yet\. Everyone gets the full album\./)).toBeTruthy();
  });

  it('shows a snoozing Pip and an Add yours tile when the album is empty', async () => {
    mockAlbum.photos = [];
    await render(<PhotosTab />);
    expect(screen.getByText('Goa getaway · No photos yet')).toBeTruthy();
    expect(screen.getByText('No photos yet. Add the first and everyone gets the full album.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add yours' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
  });

  it('shows a spinner on first load', async () => {
    mockAlbum = { photos: [], loading: true, error: null, refresh: jest.fn() };
    await render(<PhotosTab />);
    expect(screen.getByLabelText('Loading photos')).toBeTruthy();
  });

  it('offers a retry when the trip fails to load', async () => {
    mockState = tripState(null, { error: "Couldn't load this trip. Check your connection and try again." });
    await render(<PhotosTab />);
    mockState.refresh.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('offers Library or Camera on native and registers the Pip action', async () => {
    await render(<PhotosTab />);
    expect(mockPip?.label).toBe('Add photos');
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    expect(alert).toHaveBeenCalledWith('Add photos', undefined, [
      expect.objectContaining({ text: 'Choose from library' }),
      expect.objectContaining({ text: 'Take a photo' }),
      expect.objectContaining({ text: 'Cancel' }),
    ]);

    pickAlbumPhotos.mockResolvedValue([]);
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(pickAlbumPhotos).toHaveBeenCalledWith('camera');
  });

  it('opens the file picker straight away on web', () =>
    withOS('web', async () => {
      pickAlbumPhotos.mockResolvedValue([]);
      await render(<PhotosTab />);
      await fireEvent.press(screen.getByRole('button', { name: 'Add yours' }));
      expect(alert).not.toHaveBeenCalled();
      expect(pickAlbumPhotos).toHaveBeenCalledWith('library');
    }));

  it('uploads each photo with progress, keeps the good ones and reports failures', async () => {
    const picked = [1, 2, 3].map((n) => ({ uri: `file:///p${n}.jpg`, takenOn: '2027-03-01' }));
    pickAlbumPhotos.mockResolvedValue(picked);
    let release: () => void = () => {};
    addAlbumPhoto
      .mockImplementationOnce(() => new Promise<string>((resolve) => (release = () => resolve('n1'))))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('n3');

    await render(<PhotosTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    await act(async () => {
      alert.mock.calls[0][2][0].onPress();
    });
    expect(screen.getByLabelText('Uploading 1 of 3')).toBeTruthy();
    expect(pickAlbumPhotos).toHaveBeenCalledWith('library');

    mockAlbum.refresh.mockClear();
    await act(async () => release());
    await waitFor(() => expect(screen.getByText("1 of 3 photos couldn't be added. The rest are in the album.")).toBeTruthy());
    expect(addAlbumPhoto).toHaveBeenCalledTimes(3);
    expect(addAlbumPhoto).toHaveBeenCalledWith(TRIP_ID, picked[2]);
    expect(mockAlbum.refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText(/Uploading/)).toBeNull();
  });

  it('explains a denied camera', async () => {
    const { PhotoPermissionError } = jest.requireActual('@/lib/place-photo');
    pickAlbumPhotos.mockRejectedValue(new PhotoPermissionError());
    await render(<PhotosTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(screen.getByText('Allow camera access in Settings to take a photo.')).toBeTruthy();
  });
});
