import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking, Platform } from 'react-native';

import { DestinationCard } from '@/components/destination-card';
import type { Destination } from '@/lib/destinations';
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

async function renderCard(overrides: Partial<Destination> = {}, props: Partial<{ readOnly: boolean; canRemove: boolean }> = {}) {
  const onVote = jest.fn();
  const onRemove = jest.fn();
  await render(
    <DestinationCard destination={{ ...base, ...overrides }} names={names} fill="#FF5A36" readOnly={false} canRemove={false} onVote={onVote} onRemove={onRemove} {...props} />,
  );
  return { onVote, onRemove };
}

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

describe('DestinationCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the title, note, photo, link host, suggester and voters', async () => {
    await renderCard();
    expect(screen.getByRole('header', { name: 'Palolem Beach' })).toBeTruthy();
    expect(screen.getByText('Quiet cove')).toBeTruthy();
    expect(screen.getByLabelText('Photo of Palolem Beach')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open link, example.com' })).toBeTruthy();
    expect(screen.getByText('Suggested by Aarav · Voted by Aarav, Meera')).toBeTruthy();
    expect(screen.getByText('♡ Vote · 2')).toBeTruthy();
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
    expect(screen.queryByText('Quiet cove')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByLabelText(/Photo of/)).toBeNull();
    expect(screen.getByText('Suggested by Someone')).toBeTruthy();
  });

  it('names the author "Someone" once they have deleted their account', async () => {
    await renderCard({ created_by: null, voters: [], voteCount: 0 });
    expect(screen.getByText('Suggested by Someone')).toBeTruthy();
  });

  it('names unknown voters "Someone"', async () => {
    await renderCard({ voters: ['ghost'], voteCount: 1 });
    expect(screen.getByText('Suggested by Aarav · Voted by Someone')).toBeTruthy();
  });

  it('opens the link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderCard();
    await fireEvent.press(screen.getByRole('link'));
    expect(open).toHaveBeenCalledWith('https://www.example.com/palolem');
  });

  it('ignores a link that fails to open', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    await renderCard();
    await fireEvent.press(screen.getByRole('link'));
  });

  it('votes with a haptic tick', async () => {
    const { onVote } = await renderCard();
    const btn = screen.getByRole('button', { name: 'Vote for Palolem Beach' });
    expect(btn.props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    await fireEvent.press(btn);
    expect(onVote).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('shows my vote and offers to remove it', async () => {
    await renderCard({ iVoted: true });
    const btn = screen.getByRole('button', { name: 'Remove your vote for Palolem Beach' });
    expect(btn.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('♥ Voted · 2')).toBeTruthy();
  });

  it("can't vote or remove when read-only", async () => {
    const { onVote } = await renderCard({}, { readOnly: true, canRemove: true });
    const btn = screen.getByRole('button', { name: 'Vote for Palolem Beach' });
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(onVote).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove Palolem Beach' })).toBeNull();
  });

  it('only offers Remove when allowed', async () => {
    await renderCard();
    expect(screen.queryByRole('button', { name: 'Remove Palolem Beach' })).toBeNull();
  });

  it('confirms before removing on native', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { onRemove } = await renderCard({}, { canRemove: true });
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
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Palolem Beach' }));
      expect(onRemove).not.toHaveBeenCalled();
    });
  });
});
