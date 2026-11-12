import { fireEvent, render, screen } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({
  useTrip: () => mockState,
  renameTrip: jest.fn(),
  deleteTrip: jest.fn(),
  leaveTrip: jest.fn(),
  unlockTrip: jest.fn(),
  removeMember: jest.fn(),
}));

const { renameTrip, deleteTrip, leaveTrip, unlockTrip, removeMember } = require('@/lib/trips') as Record<
  'renameTrip' | 'deleteTrip' | 'leaveTrip' | 'unlockTrip' | 'removeMember',
  jest.Mock
>;
const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const TripSettings = require('@/app/(app)/trip/[id]/settings').default as () => React.JSX.Element;

describe('Trip settings', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip());
  });

  it('loads on focus and follows live updates', async () => {
    await render(<TripSettings />);
    expect(mockState.refresh).toHaveBeenCalled();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, mockState.refresh);
  });

  it('shows a spinner while loading', async () => {
    mockState = tripState(null, { loading: true });
    await render(<TripSettings />);
    expect(screen.getByLabelText('Loading settings')).toBeTruthy();
  });

  it('explains a missing trip and closes to home when there is no history', async () => {
    mockState = tripState(null);
    await render(<TripSettings />);
    expect(screen.getByText("This trip doesn't exist, or you're not a member of it.")).toBeTruthy();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  describe('as the organiser', () => {
    it('renames the trip and closes', async () => {
      renameTrip.mockResolvedValue(undefined);
      await render(<TripSettings />);
      const input = screen.getByLabelText('Trip name');
      expect(input.props.value).toBe('Goa in March');
      await fireEvent.changeText(input, '  Goa in April ');
      await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
      expect(renameTrip).toHaveBeenCalledWith(TRIP_ID, 'Goa in April');
      expect(router.back).toHaveBeenCalled();
    });

    it('needs a name', async () => {
      await render(<TripSettings />);
      await fireEvent.changeText(screen.getByLabelText('Trip name'), '   ');
      await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
      expect(screen.getByText('Give your trip a name first.')).toBeTruthy();
      expect(renameTrip).not.toHaveBeenCalled();
      await fireEvent.changeText(screen.getByLabelText('Trip name'), 'x');
      expect(screen.queryByText('Give your trip a name first.')).toBeNull();
    });

    it('only saves on submit when the name changed', async () => {
      await render(<TripSettings />);
      await fireEvent(screen.getByLabelText('Trip name'), 'submitEditing');
      expect(renameTrip).not.toHaveBeenCalled();
      await fireEvent.changeText(screen.getByLabelText('Trip name'), 'New');
      await fireEvent(screen.getByLabelText('Trip name'), 'submitEditing');
      expect(renameTrip).toHaveBeenCalledWith(TRIP_ID, 'New');
    });

    it('shows an error when renaming fails', async () => {
      renameTrip.mockRejectedValue(new Error('offline'));
      await render(<TripSettings />);
      await fireEvent.changeText(screen.getByLabelText('Trip name'), 'New');
      await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
      expect(await screen.findByText("Couldn't rename the trip. Check your connection and try again.")).toBeTruthy();
      expect(router.back).not.toHaveBeenCalled();
    });

    it("can't leave, only delete", async () => {
      await render(<TripSettings />);
      expect(screen.queryByRole('button', { name: 'Leave trip' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Delete trip' })).toBeTruthy();
    });

    it('asks before deleting, and can keep the trip', async () => {
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Delete trip' }));
      expect(screen.getByText('Delete "Goa in March" for everyone?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Keep trip' }));
      expect(screen.getByRole('button', { name: 'Delete trip' })).toBeTruthy();
      expect(deleteTrip).not.toHaveBeenCalled();
    });

    it('deletes the trip and goes home', async () => {
      deleteTrip.mockResolvedValue(undefined);
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Delete trip' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete forever' }));
      expect(deleteTrip).toHaveBeenCalledWith(TRIP_ID);
      expect(router.dismissAll).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/');
    });

    it('shows an error when deleting fails', async () => {
      deleteTrip.mockRejectedValue(new Error('Not deleted'));
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Delete trip' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete forever' }));
      expect(await screen.findByText("Couldn't delete the trip. Check your connection and try again.")).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Delete trip' })).toBeTruthy();
    });
  });

  describe('unlocking (organiser)', () => {
    it('only offers unlock when the trip is locked', async () => {
      await render(<TripSettings />);
      expect(screen.queryByRole('button', { name: 'Unlock and re-plan' })).toBeNull();
    });

    it('asks first, then unlocks and closes', async () => {
      mockState = tripState(trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-14', locked_destination_id: 'd1' }));
      unlockTrip.mockResolvedValue(undefined);
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Unlock and re-plan' }));
      expect(screen.getByText('Unlock "Goa in March" and re-plan?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Keep it locked' }));
      expect(unlockTrip).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Unlock and re-plan' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, unlock' }));
      expect(unlockTrip).toHaveBeenCalledWith(TRIP_ID);
      expect(router.back).toHaveBeenCalled();
    });

    it('shows an error when unlocking fails', async () => {
      mockState = tripState(trip({ status: 'locked' }));
      unlockTrip.mockRejectedValue(new Error('offline'));
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Unlock and re-plan' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, unlock' }));
      expect(await screen.findByText("Couldn't unlock the trip. Check your connection and try again.")).toBeTruthy();
      expect(router.back).not.toHaveBeenCalled();
    });
  });

  describe('removing members (organiser)', () => {
    it('lists members but not organisers', async () => {
      await render(<TripSettings />);
      expect(screen.getByRole('button', { name: 'Remove Meera' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Remove Aarav' })).toBeNull();
    });

    it('hides the section when there is nobody to remove', async () => {
      mockState = tripState(trip({ members: [{ user_id: ORGANISER, role: 'organiser', display_name: 'Aarav', avatar_url: null }] }));
      await render(<TripSettings />);
      expect(screen.queryByText('Members')).toBeNull();
    });

    it('asks first, then removes and reloads', async () => {
      removeMember.mockResolvedValue(undefined);
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Meera' }));
      expect(screen.getByText('Remove Meera from the trip?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
      expect(removeMember).not.toHaveBeenCalled();
      mockState.refresh.mockClear();
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Meera' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, remove Meera' }));
      expect(removeMember).toHaveBeenCalledWith(TRIP_ID, MEMBER);
      expect(mockState.refresh).toHaveBeenCalled();
    });

    it('shows an error when removing fails', async () => {
      removeMember.mockRejectedValue(new Error('Not removed'));
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Meera' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, remove Meera' }));
      expect(await screen.findByText("Couldn't remove that person. Check your connection and try again.")).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Remove Meera' })).toBeTruthy();
    });
  });

  describe('as a member', () => {
    beforeEach(() => {
      mockSession = sessionFor(MEMBER);
    });

    it("can't rename, delete, unlock or remove people", async () => {
      mockState = tripState(trip({ status: 'locked' }));
      await render(<TripSettings />);
      expect(screen.queryByRole('button', { name: 'Unlock and re-plan' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
      expect(screen.queryByLabelText('Trip name')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete trip' })).toBeNull();
    });

    it('asks before leaving, and can stay', async () => {
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave trip' }));
      expect(screen.getByText('Leave "Goa in March"?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
      expect(screen.getByRole('button', { name: 'Leave trip' })).toBeTruthy();
    });

    it('leaves and goes home', async () => {
      leaveTrip.mockResolvedValue(undefined);
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave trip' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, leave trip' }));
      expect(leaveTrip).toHaveBeenCalledWith(TRIP_ID, MEMBER);
      expect(router.dismissAll).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/');
    });

    it('shows an error when leaving fails', async () => {
      leaveTrip.mockRejectedValue(new Error('offline'));
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave trip' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, leave trip' }));
      expect(await screen.findByText("Couldn't leave the trip. Check your connection and try again.")).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Leave trip' })).toBeTruthy();
    });

    it('closes', async () => {
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      expect(router.back).toHaveBeenCalled();
    });
  });
});
