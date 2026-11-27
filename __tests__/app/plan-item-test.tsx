import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PlanItem } from '@/lib/itinerary';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState }));

let mockItems: PlanItem[] = [];
jest.mock('@/lib/itinerary', () => ({
  ...jest.requireActual('@/lib/itinerary'),
  usePlan: () => ({ items: mockItems, loading: false, error: null, refresh: jest.fn() }),
  addPlanItem: jest.fn(),
  updatePlanItem: jest.fn(),
  deletePlanItem: jest.fn(),
}));

const { addPlanItem, updatePlanItem, deletePlanItem } = require('@/lib/itinerary') as Record<string, jest.Mock>;
const PlanItemSheet = require('@/app/(app)/trip/[id]/plan-item').default as () => React.JSX.Element;

const mine: PlanItem = {
  id: 'p1',
  trip_id: TRIP_ID,
  day: '2027-03-12',
  start_time: '18:15:00',
  title: 'Sunset at the fort',
  note: 'Walk up',
  created_by: MEMBER,
  created_at: '2027-02-01T00:00:00Z',
  updated_at: '2027-02-01T00:00:00Z',
};

// Thursday 11 March to Saturday 13 March 2027.
const locked = () => trip({ status: 'locked', locked_start: '2027-03-11', locked_end: '2027-03-13' });

describe('Plan item sheet', () => {
  beforeEach(() => {
    mockSession = sessionFor(MEMBER);
    mockState = tripState(locked());
    mockItems = [mine];
  });

  describe('adding', () => {
    beforeEach(() => setParams({ id: TRIP_ID, day: '2027-03-12' }));

    it('adds a plan to the chosen day', async () => {
      addPlanItem.mockResolvedValue('new-id');
      await render(<PlanItemSheet />);
      expect(screen.getByRole('button', { name: 'Friday, March 12' })).toBeSelected();
      expect(screen.getByPlaceholderText('Where, or anything to know')).toBeTruthy();

      await fireEvent.changeText(screen.getByLabelText('Time'), '930');
      await fireEvent.changeText(screen.getByLabelText('Title'), 'Beach day');
      await fireEvent.press(screen.getByRole('button', { name: 'Add to Friday' }));
      expect(addPlanItem).toHaveBeenCalledWith(TRIP_ID, { day: '2027-03-12', time: '930', title: 'Beach day', note: '' });
      expect(router.back).toHaveBeenCalled();
    });

    it('moves to another day and uses a quick time', async () => {
      addPlanItem.mockResolvedValue('new-id');
      await render(<PlanItemSheet />);
      await fireEvent.press(screen.getByRole('button', { name: 'Saturday, March 13' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Set the time to 13:00' }));
      expect(screen.getByLabelText('Time').props.value).toBe('13:00');
      await fireEvent.changeText(screen.getByLabelText('Title'), 'Lunch');
      await fireEvent.changeText(screen.getByLabelText('Note'), 'Shack');
      await fireEvent.press(screen.getByRole('button', { name: 'Add to Saturday' }));
      expect(addPlanItem).toHaveBeenCalledWith(TRIP_ID, { day: '2027-03-13', time: '13:00', title: 'Lunch', note: 'Shack' });
    });

    it('checks the time and the title', async () => {
      await render(<PlanItemSheet />);
      await fireEvent.changeText(screen.getByLabelText('Time'), 'noon');
      await fireEvent.press(screen.getByRole('button', { name: 'Add to Friday' }));
      expect(screen.getByText('Enter a time like 9:30 or 18:00.')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Time'), '9');
      await fireEvent.press(screen.getByRole('button', { name: 'Add to Friday' }));
      expect(screen.getByText('Give the plan a title.')).toBeTruthy();
      expect(addPlanItem).not.toHaveBeenCalled();
    });

    it("explains a plan that isn't on the trip's dates", async () => {
      addPlanItem.mockRejectedValue({ code: '42501', message: 'new row violates row-level security policy' });
      await render(<PlanItemSheet />);
      await fireEvent.changeText(screen.getByLabelText('Time'), '9');
      await fireEvent.changeText(screen.getByLabelText('Title'), 'Beach');
      await fireEvent.press(screen.getByRole('button', { name: 'Add to Friday' }));
      expect(await screen.findByText("Plans can only go on the trip's dates.")).toBeTruthy();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('is closed while the trip has no dates', async () => {
      mockState = tripState(trip());
      await render(<PlanItemSheet />);
      expect(screen.getByText("The plan is built day by day, so it opens once the trip's dates are locked in.")).toBeTruthy();
      router.canGoBack.mockReturnValue(false);
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan', params: { id: TRIP_ID } });
    });
  });

  describe('editing', () => {
    beforeEach(() => setParams({ id: TRIP_ID, item: 'p1' }));

    it('prefills the plan and saves changes', async () => {
      updatePlanItem.mockResolvedValue(undefined);
      await render(<PlanItemSheet />);
      expect(screen.getByLabelText('Time').props.value).toBe('18:15');
      expect(screen.getByLabelText('Title').props.value).toBe('Sunset at the fort');
      expect(screen.getByLabelText('Note').props.value).toBe('Walk up');
      await fireEvent.changeText(screen.getByLabelText('Title'), 'Sunset at Chapora');
      await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
      expect(updatePlanItem).toHaveBeenCalledWith('p1', { day: '2027-03-12', time: '18:15', title: 'Sunset at Chapora', note: 'Walk up' });
      expect(router.back).toHaveBeenCalled();
    });

    it('deletes after a confirm', async () => {
      deletePlanItem.mockResolvedValue(undefined);
      await render(<PlanItemSheet />);
      await fireEvent.press(screen.getByRole('button', { name: 'Delete this plan' }));
      expect(deletePlanItem).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete' }));
      expect(deletePlanItem).toHaveBeenCalledWith('p1');
      expect(router.back).toHaveBeenCalled();
    });

    it('asks for a trip day when the plan is off the dates', async () => {
      mockItems = [{ ...mine, day: '2027-03-20' }];
      await render(<PlanItemSheet />);
      await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
      expect(screen.getByText('Pick one of the trip’s days.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Thursday, March 11' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
      expect(updatePlanItem).toHaveBeenCalledWith('p1', expect.objectContaining({ day: '2027-03-11' }));
    });

    it("is read-only for someone else's plan", async () => {
      mockItems = [{ ...mine, created_by: 'someone-else' }];
      await render(<PlanItemSheet />);
      expect(screen.getByText('Only the person who added this, or an organiser, can change it.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });

    it("lets an organiser change anyone's plan", async () => {
      mockSession = sessionFor(ORGANISER);
      await render(<PlanItemSheet />);
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    });

    it('says when the plan is gone', async () => {
      mockItems = [];
      await render(<PlanItemSheet />);
      expect(screen.getByText('This plan has been removed.')).toBeTruthy();
    });
  });
});
