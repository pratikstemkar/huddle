// The small form screens: join a trip, create a trip, suggest a place.
import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import { photoState } from '../../test-utils/photo-mocks';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('@/lib/trips', () => ({ joinTrip: jest.fn(), createTrip: jest.fn() }));
jest.mock('@/lib/destinations', () => ({ ...jest.requireActual('@/lib/destinations'), suggestDestination: jest.fn() }));

const { joinTrip, createTrip } = require('@/lib/trips') as { joinTrip: jest.Mock; createTrip: jest.Mock };
const { suggestDestination } = require('@/lib/destinations') as { suggestDestination: jest.Mock };
const JoinTrip = require('@/app/(app)/join').default as () => React.JSX.Element;
const NewTrip = require('@/app/(app)/new-trip').default as () => React.JSX.Element;
const SuggestPlace = require('@/app/(app)/trip/[id]/suggest').default as () => React.JSX.Element;

describe('Join a trip', () => {
  it('prefills the code from the link', async () => {
    setParams({ code: 'goa2027' });
    await render(<JoinTrip />);
    expect(screen.getByLabelText('Invite code').props.value).toBe('goa2027');
  });

  it('asks for a code before joining', async () => {
    await render(<JoinTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(screen.getByText('Enter the invite code your friend sent you.')).toBeTruthy();
    expect(joinTrip).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'a');
    expect(screen.queryByText('Enter the invite code your friend sent you.')).toBeNull();
  });

  it('joins with the trimmed code and opens the trip', async () => {
    joinTrip.mockResolvedValue('trip-1');
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), '  goa2027 ');
    await fireEvent(screen.getByLabelText('Invite code'), 'submitEditing');
    expect(joinTrip).toHaveBeenCalledWith('goa2027');
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 'trip-1' } });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('shows why joining failed', async () => {
    joinTrip.mockRejectedValue(new Error("That code doesn't match a trip. Check it and try again."));
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(await screen.findByText("That code doesn't match a trip. Check it and try again.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('has a fallback message for non-Error failures', async () => {
    joinTrip.mockRejectedValue('boom');
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'x');
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(await screen.findByText("Couldn't join the trip.")).toBeTruthy();
  });
});

describe('New trip', () => {
  it('previews a placeholder name and the default colour', async () => {
    await render(<NewTrip />);
    expect(screen.getByText('Goa in March')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Sunset' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('asks for a name first', async () => {
    await render(<NewTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
    expect(screen.getByText('Give your trip a name first.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'x');
    expect(screen.queryByText('Give your trip a name first.')).toBeNull();
  });

  it('creates the trip with the chosen name and colour, then closes', async () => {
    createTrip.mockResolvedValue({ id: 't' });
    await render(<NewTrip />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), '  Manali  ');
    expect(screen.getByText('Manali')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lagoon' }));
    expect(screen.getByRole('radio', { name: 'Lagoon' }).props.accessibilityState).toEqual({ selected: true });
    await fireEvent(screen.getByLabelText('Trip name'), 'submitEditing');
    expect(createTrip).toHaveBeenCalledWith('Manali', 'lagoon');
    expect(router.back).toHaveBeenCalled();
  });

  it('shows an error when creating fails', async () => {
    createTrip.mockRejectedValue(new Error('offline'));
    await render(<NewTrip />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'Goa');
    await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText("Couldn't create the trip. Check your connection and try again.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('Suggest a place', () => {
  beforeEach(() => setParams({ id: 'trip-1' }));

  it('needs a name', async () => {
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(screen.getByText('Give the place a name first.')).toBeTruthy();
    expect(suggestDestination).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Place name'), 'P');
    expect(screen.queryByText('Give the place a name first.')).toBeNull();
  });

  it('rejects links that are not web links', async () => {
    await render(<SuggestPlace />);
    await fireEvent.changeText(screen.getByLabelText('Place name'), 'Palolem');
    await fireEvent.changeText(screen.getByLabelText('Link'), 'not a link');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(screen.getByText("That doesn't look like a web link.")).toBeTruthy();
    expect(suggestDestination).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Link'), 'x.com');
    expect(screen.queryByText("That doesn't look like a web link.")).toBeNull();
  });

  it('adds a photo, resized to 16:9, and sends it with the place', async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///pick.jpg', width: 4000, height: 3000 }] };
    suggestDestination.mockResolvedValue('new-id');
    await render(<SuggestPlace />);
    expect(screen.queryByLabelText('Photo preview')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    expect(await screen.findByLabelText('Photo preview')).toBeTruthy();
    expect(photoState.actions.map(([a]) => a)).toEqual(['crop', 'resize', 'save']);

    await fireEvent.changeText(screen.getByLabelText('Place name'), 'Palolem');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(suggestDestination).toHaveBeenCalledWith('trip-1', expect.objectContaining({ photoUri: 'file:///cache/prepared.jpg' }));
  });

  it('removes the chosen photo', async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///pick.jpg', width: 1, height: 1 }] };
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByLabelText('Photo preview')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeTruthy();
  });

  it('keeps the form as it was when picking is cancelled', async () => {
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    expect(screen.queryByLabelText('Photo preview')).toBeNull();
    expect(photoState.actions).toEqual([]);
  });

  it("says so when a photo can't be used", async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///bad', width: 0, height: 0 }] };
    photoState.failDecode = true;
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    expect(await screen.findByText("Couldn't use that photo. Try another one.")).toBeTruthy();
  });

  it('explains when the camera is not allowed', async () => {
    photoState.cameraGranted = false;
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByText('Allow camera access in Settings to take a photo.')).toBeTruthy();
  });

  it('adds the place with normalised links and closes', async () => {
    suggestDestination.mockResolvedValue(undefined);
    await render(<SuggestPlace />);
    await fireEvent.changeText(screen.getByLabelText('Place name'), ' Palolem ');
    await fireEvent.changeText(screen.getByLabelText('Note'), ' quiet ');
    await fireEvent.changeText(screen.getByLabelText('Link'), 'example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(suggestDestination).toHaveBeenCalledWith('trip-1', { title: 'Palolem', note: 'quiet', url: 'https://example.com', photoUri: undefined });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows an error when saving fails', async () => {
    suggestDestination.mockRejectedValue(new Error('offline'));
    await render(<SuggestPlace />);
    await fireEvent.changeText(screen.getByLabelText('Place name'), 'Palolem');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(await screen.findByText("Couldn't add that place. Check your connection and try again.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("doesn't save without a trip id", async () => {
    setParams({});
    await render(<SuggestPlace />);
    await fireEvent.changeText(screen.getByLabelText('Place name'), 'Palolem');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(suggestDestination).not.toHaveBeenCalled();
  });
});
