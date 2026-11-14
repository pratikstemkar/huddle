import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { formatDay } from '@/lib/dates';
import type { AlbumPhoto } from '@/lib/trip-photos';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, sessionFor, trip, tripState } from '../../test-utils/fixtures';

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
  deleteAlbumPhoto: jest.fn(),
  signFull: jest.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://full/${p}`]))),
}));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const { deleteAlbumPhoto, signFull } = require('@/lib/trip-photos') as { deleteAlbumPhoto: jest.Mock; signFull: jest.Mock };
const PhotoViewer = require('@/app/(app)/trip/[id]/photo/[photoId]').default as () => React.JSX.Element;

const dated = trip({ locked_start: '2027-03-01', locked_end: '2027-03-03', status: 'locked' });
const short = (day: string) => formatDay(day, { day: 'numeric', month: 'short' });

function photo(id: string, uploaded_by: string, taken_on: string): AlbumPhoto {
  return {
    id,
    trip_id: TRIP_ID,
    uploaded_by,
    path: `${TRIP_ID}/${id}.jpg`,
    thumb_path: `${TRIP_ID}/${id}-thumb.jpg`,
    width: 1600,
    height: 1200,
    taken_on,
    created_at: `${taken_on}T10:00:00Z`,
    thumbUrl: `https://thumb/${id}`,
  };
}

const ALBUM = [photo('p1', ORGANISER, '2027-03-01'), photo('p2', MEMBER, '2027-03-02'), photo('p3', MEMBER, '2027-03-03')];

describe('Photo viewer', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    setParams({ id: TRIP_ID, photoId: 'p2', filter: 'all' });
    mockSession = sessionFor(MEMBER, 'Meera');
    mockState = tripState(dated);
    mockAlbum = { photos: ALBUM, loading: false, error: null, refresh: jest.fn() };
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alert.mock && alert.mockRestore());

  it('loads, follows live changes and captions the photo', async () => {
    await render(<PhotoViewer />);
    expect(mockAlbum.refresh).toHaveBeenCalled();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, expect.any(Function), ['trip_photos', 'trip_members', 'trips']);
    expect(screen.getByText(`You · Day 2 · ${short('2027-03-02')}`)).toBeTruthy();
    expect(screen.getByLabelText('Photo 2 of 3')).toBeTruthy();
  });

  it('signs the full photo and its neighbours', async () => {
    await render(<PhotoViewer />);
    await waitFor(() => expect(signFull).toHaveBeenCalledWith([`${TRIP_ID}/p1.jpg`, `${TRIP_ID}/p2.jpg`, `${TRIP_ID}/p3.jpg`]));
  });

  it('pages through the filter it was opened with', async () => {
    mockSession = sessionFor(ORGANISER);
    setParams({ id: TRIP_ID, photoId: 'p3', filter: '3' });
    await render(<PhotoViewer />);
    expect(screen.getByText(`Meera · Day 3 · ${short('2027-03-03')}`)).toBeTruthy();
    // Only one photo on day 3, so there's nothing to count.
    expect(screen.queryByLabelText(/Photo \d of/)).toBeNull();
  });

  it('closes back to the album', async () => {
    await render(<PhotoViewer />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
  });

  it("hides Delete on someone else's photo unless I'm an organiser", async () => {
    setParams({ id: TRIP_ID, photoId: 'p1', filter: 'all' });
    await render(<PhotoViewer />);
    expect(screen.getByText(`Aarav · Day 1 · ${short('2027-03-01')}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete photo' })).toBeNull();
  });

  it('lets an organiser delete any photo, after confirming', async () => {
    mockSession = sessionFor(ORGANISER);
    deleteAlbumPhoto.mockResolvedValue(undefined);
    await render(<PhotoViewer />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete photo' }));
    expect(alert).toHaveBeenCalledWith('Delete this photo?', "It's removed for everyone on the trip.", expect.any(Array));
    expect(deleteAlbumPhoto).not.toHaveBeenCalled();

    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(deleteAlbumPhoto).toHaveBeenCalledWith(ALBUM[1]);
    expect(mockAlbum.refresh).toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('closes after deleting the last photo in the filter', async () => {
    setParams({ id: TRIP_ID, photoId: 'p2', filter: 'mine' });
    deleteAlbumPhoto.mockResolvedValue(undefined);
    mockAlbum.photos = [ALBUM[0], ALBUM[1]];
    await render(<PhotoViewer />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete photo' }));
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(router.back).toHaveBeenCalled();
  });

  it('says when a delete fails', async () => {
    deleteAlbumPhoto.mockRejectedValue(new Error('offline'));
    await render(<PhotoViewer />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete photo' }));
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(screen.getByText("Couldn't delete that photo. Check your connection and try again.")).toBeTruthy();
  });

  it('explains a photo that is gone', async () => {
    mockAlbum.photos = [];
    setParams({ id: TRIP_ID, photoId: 'gone', filter: 'all' });
    await render(<PhotoViewer />);
    expect(screen.getByText("This photo isn't in the album any more.")).toBeTruthy();
  });
});
