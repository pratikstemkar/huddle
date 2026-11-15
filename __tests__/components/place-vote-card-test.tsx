import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking, Platform, StyleSheet } from 'react-native';

import { PlaceVoteCard } from '@/components/vote/place-vote-card';
import type { Destination } from '@/lib/destinations';
import { palette } from '@/theme/tokens';
import { photoState } from '../../test-utils/photo-mocks';

const { File } = jest.requireMock('expo-file-system') as typeof import('../../test-utils/photo-mocks').fileSystem;

const base: Destination = {
  id: 'd1',
  trip_id: 't1',
  title: 'Palolem Beach',
  note: 'Quiet cove',
  url: 'https://www.example.com/palolem',
  image_url: 'https://img.example.com/p.jpg',
  image_path: null,
  photoUrl: 'https://img.example.com/p.jpg',
  created_by: 'u1',
  created_at: '2027-01-01',
  voteCount: 2,
  voters: ['u1', 'u2'],
  iVoted: false,
};

const names = new Map([
  ['u1', 'Aarav'],
  ['u2', 'Meera'],
]);

type Extra = Partial<{ readOnly: boolean; canRemove: boolean; leading: boolean; memberCount: number }>;

async function renderCard(overrides: Partial<Destination> = {}, props: Extra = {}) {
  const onVote = jest.fn();
  const onRemove = jest.fn();
  await render(
    <PlaceVoteCard
      destination={{ ...base, ...overrides }}
      names={names}
      memberCount={4}
      leading={false}
      readOnly={false}
      canRemove={false}
      onVote={onVote}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onVote, onRemove };
}

const expand = (title = 'Palolem Beach', votes = 2) => fireEvent.press(screen.getByRole('button', { name: `${title}, ${votes} ${votes === 1 ? 'vote' : 'votes'}` }));
const bg = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { backgroundColor?: string }).backgroundColor;

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

describe('PlaceVoteCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the name, suggester with note, thumbnail, vote count and progress', async () => {
    await renderCard();
    expect(screen.getByText('Palolem Beach')).toBeTruthy();
    expect(screen.getByText('Suggested by Aarav · Quiet cove')).toBeTruthy();
    expect(screen.getByLabelText('Photo of Palolem Beach')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByLabelText('2 of 4 voted for Palolem Beach').props.accessibilityValue).toMatchObject({ now: 50 });
    expect(screen.queryByText('Leading')).toBeNull();
    // Details stay folded until the card is tapped.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Voted by Aarav, Meera')).toBeNull();
  });

  it('shows the Leading chip', async () => {
    await renderCard({}, { leading: true });
    expect(screen.getByText('Leading')).toBeTruthy();
  });

  it('expands to the photo, link and voters, and folds again', async () => {
    await renderCard();
    await expand();
    expect(screen.getByRole('button', { name: 'Palolem Beach, 2 votes' }).props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getAllByLabelText('Photo of Palolem Beach')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open link, example.com' })).toBeTruthy();
    expect(screen.getByText('Voted by Aarav, Meera')).toBeTruthy();
    await expand();
    expect(screen.queryByText('Voted by Aarav, Meera')).toBeNull();
  });

  it('shows an uploaded photo from the Huddle folder when the device has a copy', async () => {
    photoState.files.add('file:///docs/huddle/trips/t1/places/d1.jpg');
    await renderCard({ image_url: null, image_path: 't1/d1.jpg', photoUrl: 'https://signed/d1' });
    expect(screen.getByLabelText('Photo of Palolem Beach').props.source).toEqual(
      expect.arrayContaining([expect.objectContaining({ uri: 'file:///docs/huddle/trips/t1/places/d1.jpg' })]),
    );
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });

  it('otherwise loads the uploaded photo and saves a copy to the Huddle folder', async () => {
    await renderCard({ image_url: null, image_path: 't1/d1.jpg', photoUrl: 'https://signed/d1' });
    expect(screen.getByLabelText('Photo of Palolem Beach').props.source).toEqual(
      expect.arrayContaining([expect.objectContaining({ uri: 'https://signed/d1' })]),
    );
    expect(File.downloadFileAsync).toHaveBeenCalledWith('https://signed/d1', expect.objectContaining({ uri: 'file:///docs/huddle/trips/t1/places/d1.jpg' }));
  });

  it('hides optional parts and uses "Someone" for unknown people', async () => {
    await renderCard({ note: null, url: null, image_url: null, photoUrl: null, created_by: 'stranger', voters: [], voteCount: 0 });
    expect(screen.getByText('Suggested by Someone')).toBeTruthy();
    expect(screen.queryByLabelText(/Photo of/)).toBeNull();
    await expand('Palolem Beach', 0);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByLabelText(/Photo of/)).toBeNull();
    expect(screen.getByText('No votes yet')).toBeTruthy();
  });

  it('names the author "Someone" once they have deleted their account', async () => {
    await renderCard({ created_by: null, note: null });
    expect(screen.getByText('Suggested by Someone')).toBeTruthy();
  });

  it('names unknown voters "Someone"', async () => {
    await renderCard({ voters: ['ghost'], voteCount: 1 });
    await expand('Palolem Beach', 1);
    expect(screen.getByText('Voted by Someone')).toBeTruthy();
  });

  it('opens the link, and ignores one that fails to open', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderCard();
    await expand();
    await fireEvent.press(screen.getByRole('link'));
    expect(open).toHaveBeenCalledWith('https://www.example.com/palolem');
    open.mockRejectedValue(new Error('no handler'));
    await fireEvent.press(screen.getByRole('link'));
  });

  it('votes with a haptic tick', async () => {
    const { onVote } = await renderCard();
    const btn = screen.getByRole('button', { name: 'Vote for Palolem Beach' });
    expect(btn.props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    expect(bg(btn)).toBe(palette.light.tint.vote);
    await fireEvent.press(btn);
    expect(onVote).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('shows my vote in iris and offers to remove it', async () => {
    await renderCard({ iVoted: true });
    const btn = screen.getByRole('button', { name: 'Remove your vote for Palolem Beach' });
    expect(btn.props.accessibilityState).toMatchObject({ selected: true });
    expect(bg(btn)).toBe(palette.light.iris);
  });

  it("can't vote or remove when read-only", async () => {
    const { onVote } = await renderCard({}, { readOnly: true, canRemove: true });
    const btn = screen.getByRole('button', { name: 'Vote for Palolem Beach' });
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(onVote).not.toHaveBeenCalled();
    await expand();
    expect(screen.queryByRole('button', { name: 'Remove Palolem Beach' })).toBeNull();
  });

  it('only offers Remove when allowed', async () => {
    await renderCard();
    await expand();
    expect(screen.queryByRole('button', { name: 'Remove Palolem Beach' })).toBeNull();
  });

  it('confirms before removing on native', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { onRemove } = await renderCard({}, { canRemove: true });
    await expand();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Palolem Beach' }));
    expect(alert).toHaveBeenCalledWith('Remove "Palolem Beach"?', 'Its votes go too.', expect.any(Array));
    expect(onRemove).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Remove']);
    buttons[1].onPress!();
    expect(onRemove).toHaveBeenCalled();
  });

  it('confirms with the browser dialog on web', async () => {
    const confirm = jest.fn(() => true);
    (window as unknown as { confirm: typeof confirm }).confirm = confirm;
    await withOS('web', async () => {
      const { onRemove, onVote } = await renderCard({}, { canRemove: true });
      await expand();
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Palolem Beach' }));
      expect(confirm).toHaveBeenCalledWith('Remove "Palolem Beach"? Its votes go too.');
      expect(onRemove).toHaveBeenCalled();

      (Haptics.selectionAsync as jest.Mock).mockClear();
      await fireEvent.press(screen.getByRole('button', { name: 'Vote for Palolem Beach' }));
      expect(onVote).toHaveBeenCalled();
      expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    });
  });

  it('keeps the place when the web dialog is cancelled', async () => {
    (window as unknown as { confirm: () => boolean }).confirm = () => false;
    await withOS('web', async () => {
      const { onRemove } = await renderCard({}, { canRemove: true });
      await expand();
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Palolem Beach' }));
      expect(onRemove).not.toHaveBeenCalled();
    });
  });
});
