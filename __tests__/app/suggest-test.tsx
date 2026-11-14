import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import { photoState } from '../../test-utils/photo-mocks';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('@/lib/destinations', () => ({ ...jest.requireActual('@/lib/destinations'), suggestDestination: jest.fn() }));

const { suggestDestination } = require('@/lib/destinations') as { suggestDestination: jest.Mock };
const SuggestPlace = require('@/app/(app)/trip/[id]/suggest').default as () => React.JSX.Element;

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
    expect(screen.getByText('Add a photo')).toBeTruthy();
    expect(screen.queryByLabelText('Photo preview')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    expect(await screen.findByLabelText('Photo preview')).toBeTruthy();
    expect(photoState.actions.map(([a]) => a)).toEqual(['crop', 'resize', 'save']);

    await fireEvent.changeText(screen.getByLabelText('Place name'), 'Palolem');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(suggestDestination).toHaveBeenCalledWith('trip-1', expect.objectContaining({ photoUri: 'file:///cache/prepared.jpg' }));
  });

  it('changes the chosen photo', async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///pick.jpg', width: 1, height: 1 }] };
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Change photo' }));
    expect(photoState.actions.filter(([a]) => a === 'save')).toHaveLength(2);
    expect(screen.getByLabelText('Photo preview')).toBeTruthy();
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

  it('hides Take photo on the web', async () => {
    const prev = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      await render(<SuggestPlace />);
      expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: prev, configurable: true });
    }
  });

  it('adds the place with normalised links and closes', async () => {
    suggestDestination.mockResolvedValue(undefined);
    await render(<SuggestPlace />);
    expect(screen.getByText('Pip says A photo helps people vote.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Place name'), ' Palolem ');
    await fireEvent.changeText(screen.getByLabelText('Note'), ' quiet ');
    await fireEvent.changeText(screen.getByLabelText('Link'), 'example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(suggestDestination).toHaveBeenCalledWith('trip-1', { title: 'Palolem', note: 'quiet', url: 'https://example.com', photoUri: undefined });
    expect(Haptics.notificationAsync).toHaveBeenCalled();
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

  it('closes with the X, or goes to the trip without history', async () => {
    await render(<SuggestPlace />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 'trip-1' } });
  });
});
