import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { PostcardStack } from '@/components/postcard-stack';

describe('PostcardStack', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])('shows the three sample postcards (reduce motion: %p)', async (reduced) => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced);
    await render(<PostcardStack />);
    for (const place of ['Goa', 'Manali', 'Pondy']) expect(screen.getByText(place, { includeHiddenElements: true })).toBeTruthy();
  });

  it('is hidden from screen readers (decorative)', async () => {
    await render(<PostcardStack />);
    expect(screen.queryByText('Goa')).toBeNull();
  });
});
