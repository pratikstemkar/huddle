import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import type { HangoutDetail } from '@/lib/hangouts';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), useAuth: () => ({ session: mockSession }) }));

let mockHangout: { hangout: HangoutDetail | null; loading: boolean; error: string | null; refresh: jest.Mock };
jest.mock('@/lib/hangouts', () => ({
  ...jest.requireActual('@/lib/hangouts'),
  useHangout: () => mockHangout,
  answerHangout: jest.fn(),
  lockHangout: jest.fn(),
  cancelHangout: jest.fn(),
}));
jest.mock('@/lib/calendar', () => ({ ...jest.requireActual('@/lib/calendar'), addEventToCalendar: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/components/trip/share', () => ({ useShareOrCopy: () => ({ share: mockShare, copied: false }) }));
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), appLink: (path: string) => `https://huddle.test/${path}` }));
const mockShare = jest.fn();

const { answerHangout, lockHangout, cancelHangout } = require('@/lib/hangouts') as Record<string, jest.Mock>;
const { addEventToCalendar } = require('@/lib/calendar') as { addEventToCalendar: jest.Mock };
const Hangout = require('@/app/(app)/hangout/[id]/index').default as () => React.JSX.Element;
const Lock = require('@/app/(app)/hangout/[id]/lock').default as () => React.JSX.Element;
const { sessionFor } = require('../../test-utils/fixtures') as typeof import('../../test-utils/fixtures');

const person = (id: string, name: string) => ({ user_id: id, display_name: name, avatar_url: null, avatar_color: null });
const at = (day: number, hour: number) => new Date(2027, 0, day, hour).toISOString();

function hangout(over: Partial<HangoutDetail> = {}): HangoutDetail {
  return {
    id: 'h1',
    group_id: 'g1',
    group_name: 'College gang',
    created_by: 'u1',
    organiser: 'Aarav',
    kind: 'dinner',
    name: 'Dinner with the gang',
    place_url: 'https://www.google.com/maps/place/Nori+House/@1,2,3z',
    place_name: 'Nori House',
    mode: 'find',
    duration_min: 120,
    answers_close_at: null,
    status: 'open',
    locked_slot_id: null,
    members: [person('u1', 'Aarav'), person('u2', 'Meera'), person('u3', 'Kabir')],
    slots: [
      { id: 's1', starts_at: at(8, 19), ends_at: at(8, 21), answers: [{ user_id: 'u1', answer: 'yes' }, { user_id: 'u2', answer: 'yes' }] },
      { id: 's2', starts_at: at(9, 19), ends_at: at(9, 21), answers: [{ user_id: 'u2', answer: 'maybe' }] },
    ],
    ...over,
  };
}

beforeEach(() => {
  mockSession = sessionFor('u2', 'Meera Rao');
  mockHangout = { hangout: hangout(), loading: false, error: null, refresh: jest.fn().mockResolvedValue(undefined) };
  for (const fn of [answerHangout, lockHangout, cancelHangout]) fn.mockReset().mockResolvedValue(undefined);
  addEventToCalendar.mockClear();
  mockShare.mockReset();
  setParams({ id: 'h1' });
});

describe('Hangout', () => {
  it('shows who asked, the place and the times, with the best one marked', async () => {
    await render(<Hangout />);
    expect(screen.getByText('Aarav invited College gang')).toBeTruthy();
    expect(screen.getByText('Dinner with the gang')).toBeTruthy();
    expect(screen.getByText('About 2 hrs · 1 of 2 answered')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nori House, open in Maps' })).toBeTruthy();
    expect(screen.getAllByText('Best so far')).toHaveLength(1);
    expect(screen.getByText('2 can make it')).toBeTruthy();
    expect(screen.getByText('0 can make it · 1 if needed')).toBeTruthy();
    expect(screen.getByText('Your answers are saved as you tap.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lock a time' })).toBeNull();
  });

  it('saves an answer as it is tapped, and clears it when tapped again', async () => {
    await render(<Hangout />);
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Works' })[1]);
    await waitFor(() => expect(answerHangout).toHaveBeenCalledWith('s2', 'yes'));
    expect(mockHangout.refresh).toHaveBeenCalled();
    // Meera already said yes to the first time: tapping Works again takes it back.
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Works' })[0]);
    await waitFor(() => expect(answerHangout).toHaveBeenCalledWith('s1', null));
  });

  it('shows a failed answer', async () => {
    answerHangout.mockRejectedValue(new Error('That hangout is already settled'));
    await render(<Hangout />);
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Can’t' })[0]);
    expect(await screen.findByText('That hangout is already settled')).toBeTruthy();
  });

  it('gives the organiser the Lock button and a two-step cancel', async () => {
    mockSession = sessionFor('u1', 'Aarav Shah');
    await render(<Hangout />);
    expect(screen.getByText('You invited College gang')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lock a time' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/hangout/[id]/lock', params: { id: 'h1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel hangout' }));
    expect(cancelHangout).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel for everyone' }));
    await waitFor(() => expect(cancelHangout).toHaveBeenCalledWith('h1'));
    expect(router.back).toHaveBeenCalled();
  });

  it('shows a locked time with who is going and adds it to the calendar', async () => {
    mockHangout.hangout = hangout({ status: 'locked', locked_slot_id: 's1' });
    await render(<Hangout />);
    expect(screen.getByText('Locked in')).toBeTruthy();
    expect(screen.getByText('2 people are in')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Works' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to calendar' }));
    expect(addEventToCalendar).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1', name: 'Dinner with the gang', place: 'Nori House' }));
  });

  it('asks for in or out on an I’ll-pick-it hangout', async () => {
    mockHangout.hangout = hangout({
      mode: 'set',
      slots: [{ id: 's1', starts_at: at(8, 19), ends_at: null, answers: [{ user_id: 'u1', answer: 'yes' }] }],
    });
    await render(<Hangout />);
    expect(screen.getByText('Set by the organiser')).toBeTruthy();
    expect(screen.getByText('1 person is in')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'I’m in' }));
    await waitFor(() => expect(answerHangout).toHaveBeenCalledWith('s1', 'yes'));
  });

  it('says a hangout was cancelled', async () => {
    mockHangout.hangout = hangout({ status: 'cancelled' });
    await render(<Hangout />);
    expect(screen.getByText('Aarav cancelled this hangout.')).toBeTruthy();
  });

  it('copes with a hangout that is missing', async () => {
    mockHangout = { ...mockHangout, hangout: null };
    await render(<Hangout />);
    expect(screen.getByText(/isn’t here/)).toBeTruthy();
  });
});

describe('Lock the time', () => {
  beforeEach(() => {
    mockSession = sessionFor('u1', 'Aarav Shah');
  });

  it('starts on the time most people can make and locks it', async () => {
    await render(<Lock />);
    expect(screen.getByText('1 of 2 answered · Nori House')).toBeTruthy();
    expect(screen.getByText('Most people')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock in Fri 7 PM' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in Fri 7 PM' }));
    await waitFor(() => expect(lockHangout).toHaveBeenCalledWith('h1', 's1'));
    expect(router.back).toHaveBeenCalled();
  });

  it('locks another time when it is picked', async () => {
    await render(<Lock />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Sat 9 · 7 – 9 PM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in Sat 7 PM' }));
    await waitFor(() => expect(lockHangout).toHaveBeenCalledWith('h1', 's2'));
  });

  it('nudges whoever has not answered through the share sheet', async () => {
    await render(<Lock />);
    expect(screen.getByText('Kabir hasn’t answered yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Nudge' }));
    expect(mockShare).toHaveBeenCalledWith(expect.stringContaining('Dinner with the gang'));
    expect(mockShare).toHaveBeenCalledWith(expect.stringContaining('https://huddle.test/hangout/h1'));
  });

  it('keeps everyone but the organiser out', async () => {
    mockSession = sessionFor('u2', 'Meera Rao');
    await render(<Lock />);
    expect(screen.getByText('Only the organiser can lock the time.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Lock in/ })).toBeNull();
  });

  it('shows a failed lock and stays open', async () => {
    lockHangout.mockRejectedValue(new Error("Couldn't lock the time. Check your connection and try again."));
    await render(<Lock />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in Fri 7 PM' }));
    expect(await screen.findByText("Couldn't lock the time. Check your connection and try again.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});
