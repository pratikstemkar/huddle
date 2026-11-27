import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { formatDay, today } from '@/lib/dates';

import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, sessionFor, trip, tripState } from '../../test-utils/fixtures';
import { queueResult, rpcCalls } from '../../test-utils/supabase-mock';

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
  setShowWhoMarked: jest.fn(),
  updateTrip: jest.fn(),
}));

const { renameTrip, deleteTrip, leaveTrip, unlockTrip, removeMember, setShowWhoMarked, updateTrip } = require('@/lib/trips') as Record<
  'renameTrip' | 'deleteTrip' | 'leaveTrip' | 'unlockTrip' | 'removeMember' | 'setShowWhoMarked' | 'updateTrip',
  jest.Mock
>;

/** Meera owes Aarav ₹600: one ₹1,200 dinner, split two ways. Queued a few times for repeat loads. */
function queueDebt() {
  const expense = {
    id: 'e1',
    trip_id: TRIP_ID,
    title: 'Dinner',
    category: 'food',
    amount_minor: 120000,
    paid_by: ORGANISER,
    created_by: ORGANISER,
    created_at: '2027-01-03T00:00:00Z',
    expense_shares: [
      { user_id: ORGANISER, share_minor: 60000 },
      { user_id: MEMBER, share_minor: 60000 },
    ],
  };
  for (let i = 0; i < 4; i++) {
    queueResult('expenses', { data: [expense] });
    queueResult('settlements', { data: [] });
  }
}

/** The 10th and 12th of next month, so they're never in the past. */
function nextMonthDays() {
  const now = new Date(`${today()}T00:00:00Z`);
  const day = (d: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, d)).toISOString().slice(0, 10);
  return [day(10), day(12)];
}
const dayLabel = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
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
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, expect.any(Function));
    mockState.refresh.mockClear();
    await act(async () => useTripLive.mock.calls[0][1]());
    expect(mockState.refresh).toHaveBeenCalled();
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

    it('changes the colour', async () => {
      updateTrip.mockResolvedValue(undefined);
      await render(<TripSettings />);
      expect(screen.getByRole('radio', { name: 'Coral' })).toBeChecked();
      await fireEvent.press(screen.getByRole('radio', { name: 'Mint' }));
      expect(updateTrip).toHaveBeenCalledWith(TRIP_ID, { color: 'mint' });
      expect(mockState.refresh).toHaveBeenCalled();
    });

    it('shows an error when the colour change fails', async () => {
      updateTrip.mockRejectedValue(new Error('offline'));
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('radio', { name: 'Mint' }));
      expect(await screen.findByText("Couldn't change the colour. Check your connection and try again.")).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Coral' })).toBeChecked();
    });

    it('sets fixed dates with the range picker', async () => {
      updateTrip.mockResolvedValue(undefined);
      const [start, end] = nextMonthDays();
      await render(<TripSettings />);
      expect(screen.getByRole('radio', { name: "Let the group vote, Everyone marks the days they're free" })).toBeChecked();
      await fireEvent.press(screen.getByRole('radio', { name: 'I already know, Set the dates yourself' }));
      expect(screen.queryByRole('button', { name: 'Save dates' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
      await fireEvent.press(screen.getByRole('button', { name: dayLabel(start) }));
      await fireEvent.press(screen.getByRole('button', { name: dayLabel(end) }));
      await fireEvent.press(screen.getByRole('button', { name: 'Save dates' }));
      expect(updateTrip).toHaveBeenCalledWith(TRIP_ID, { fixed_start: start, fixed_end: end });
      expect(mockState.refresh).toHaveBeenCalled();
    });

    it('goes back to a group vote by clearing the fixed dates', async () => {
      updateTrip.mockResolvedValue(undefined);
      mockState = tripState(trip({ fixed_start: '2027-05-01', fixed_end: '2027-05-03' }));
      await render(<TripSettings />);
      expect(screen.getByRole('radio', { name: 'I already know, Set the dates yourself' })).toBeChecked();
      await fireEvent.press(screen.getByRole('radio', { name: "Let the group vote, Everyone marks the days they're free" }));
      expect(updateTrip).toHaveBeenCalledWith(TRIP_ID, { fixed_start: null, fixed_end: null });
    });

    it('shows an error when changing the dates fails', async () => {
      updateTrip.mockRejectedValue(new Error('offline'));
      mockState = tripState(trip({ fixed_start: '2027-05-01', fixed_end: '2027-05-03' }));
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('radio', { name: "Let the group vote, Everyone marks the days they're free" }));
      expect(await screen.findByText("Couldn't change the dates. Check your connection and try again.")).toBeTruthy();
    });

    it('hides the dates once the trip is locked', async () => {
      mockState = tripState(trip({ status: 'locked' }));
      await render(<TripSettings />);
      expect(screen.queryByRole('radio', { name: 'I already know, Set the dates yourself' })).toBeNull();
    });

    it('opens the lock sheet while planning', async () => {
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/lock', params: { id: TRIP_ID } });
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
    it('hides who marked each day, then reloads', async () => {
      setShowWhoMarked.mockResolvedValue(undefined);
      await render(<TripSettings />);
      const toggle = screen.getByLabelText('Show who marked each day');
      expect(toggle.props.value).toBe(true);
      expect(screen.getByText('Everyone can see whose days are whose.')).toBeTruthy();
      await fireEvent(toggle, 'valueChange', false);
      expect(setShowWhoMarked).toHaveBeenCalledWith(TRIP_ID, false);
      expect(mockState.refresh).toHaveBeenCalled();
    });

    it('explains what hiding means when names are hidden', async () => {
      mockState = tripState(trip({ show_who_marked: false }));
      await render(<TripSettings />);
      expect(screen.getByLabelText('Show who marked each day').props.value).toBe(false);
      expect(screen.getByText(/Everyone sees only how many people are free each day, not who/)).toBeTruthy();
    });

    it('shows an error when changing who can see fails', async () => {
      setShowWhoMarked.mockRejectedValue(new Error('offline'));
      await render(<TripSettings />);
      await fireEvent(screen.getByLabelText('Show who marked each day'), 'valueChange', false);
      expect(await screen.findByText("Couldn't change who can see marked days. Check your connection and try again.")).toBeTruthy();
      expect(screen.getByLabelText('Show who marked each day').props.value).toBe(true);
    });

    it('lists members but not organisers', async () => {
      await render(<TripSettings />);
      expect(screen.getByRole('button', { name: 'Remove Meera' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Remove Aarav' })).toBeNull();
    });

    it('lists just the organiser when there is nobody to remove', async () => {
      mockState = tripState(trip({ members: [{ user_id: ORGANISER, role: 'organiser', joined_at: '2027-01-01T00:00:00Z', display_name: 'Aarav', avatar_url: null, avatar_color: null }] }));
      await render(<TripSettings />);
      expect(screen.getByText('Aarav (you)')).toBeTruthy();
      expect(screen.getByText('Organiser')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    });

    it("says what someone still owes before removing them", async () => {
      queueDebt();
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Meera' }));
      expect(await screen.findByText(/^Meera still owes ₹\s?600\. It stays on the trip's Split\.$/)).toBeTruthy();
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

    it("can't change who sees marked days", async () => {
      mockSession = sessionFor(MEMBER);
      await render(<TripSettings />);
      expect(screen.queryByLabelText('Show who marked each day')).toBeNull();
    });

    it("can't rename, delete, unlock or remove people", async () => {
      mockState = tripState(trip({ status: 'locked' }));
      await render(<TripSettings />);
      expect(screen.queryByRole('button', { name: 'Unlock and re-plan' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
      expect(screen.queryByLabelText('Trip name')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete trip' })).toBeNull();
    });

    it('says only the organiser can change the trip', async () => {
      await render(<TripSettings />);
      expect(screen.getByText('Pip says Only Aarav can change this trip.')).toBeTruthy();
    });

    it('mentions what I still owe when leaving', async () => {
      queueDebt();
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave trip' }));
      expect(await screen.findByText(/^You still owe ₹\s?600\. It stays on the trip's Split\.$/)).toBeTruthy();
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

  describe('moving the plan with new dates (organiser)', () => {
    beforeEach(() => {
      updateTrip.mockResolvedValue(undefined);
      mockState = tripState(trip({ fixed_start: '2027-05-01', fixed_end: '2027-05-03' }));
    });

    it('moves the plan by default when the start day changes', async () => {
      await render(<TripSettings />);
      expect(screen.queryByLabelText('Move the plan too')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: dayLabel('2027-05-10') }));
      await fireEvent.press(screen.getByRole('button', { name: dayLabel('2027-05-12') }));
      expect(screen.getByLabelText('Move the plan too').props.value).toBe(true);
      expect(screen.getByText('Every plan moves 9 days later, so each stays on the same day of the trip.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Save dates' }));
      expect(updateTrip).toHaveBeenCalledWith(TRIP_ID, { fixed_start: '2027-05-10', fixed_end: '2027-05-12' });
      expect(rpcCalls).toContainEqual({ name: 'shift_plan', args: { t: TRIP_ID, days: 9 } });
    });

    it('leaves the plan where it is when switched off', async () => {
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: dayLabel('2027-05-10') }));
      await fireEvent.press(screen.getByRole('button', { name: dayLabel('2027-05-12') }));
      await fireEvent(screen.getByLabelText('Move the plan too'), 'valueChange', false);
      expect(screen.getByText('Plans stay on their dates. Any that fall off the new dates are listed apart on the Plan tab.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Save dates' }));
      expect(updateTrip).toHaveBeenCalled();
      expect(rpcCalls.find((c) => c.name === 'shift_plan')).toBeUndefined();
    });

    it("doesn't offer it when only the last day changes", async () => {
      await render(<TripSettings />);
      await fireEvent.press(screen.getByRole('button', { name: `${dayLabel('2027-05-01')}, first day` }));
      await fireEvent.press(screen.getByRole('button', { name: dayLabel('2027-05-05') }));
      expect(screen.queryByLabelText('Move the plan too')).toBeNull();
    });
  });
});
