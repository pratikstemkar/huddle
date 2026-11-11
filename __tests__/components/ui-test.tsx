import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text as RNText, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { palette } from '@/theme/tokens';


const light = palette.light;
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('Text', () => {
  it('renders body text in the primary colour by default', async () => {
    await render(<Text>Hello</Text>);
    const el = screen.getByText('Hello');
    expect(flat(el).color).toBe(light.text);
    expect(el.props.accessibilityRole).toBeUndefined();
    expect(el.props.maxFontSizeMultiplier).toBe(2);
  });

  it.each(['hero', 'title', 'heading'] as const)('marks the %s variant as a header', async (variant) => {
    await render(<Text variant={variant}>Head</Text>);
    expect(screen.getByRole('header', { name: 'Head' }).props.maxFontSizeMultiplier).toBe(1.4);
  });

  it.each([
    ['secondary', light.textSecondary],
    ['muted', light.textMuted],
    ['accent', light.accent],
    ['onColor', light.onColor],
    ['danger', light.danger],
  ] as const)('uses the %s tone colour', async (tone, color) => {
    await render(<Text tone={tone}>T</Text>);
    expect(flat(screen.getByText('T')).color).toBe(color);
  });

  it('lets a passed style win', async () => {
    await render(<Text style={{ color: 'red' }}>T</Text>);
    expect(flat(screen.getByText('T')).color).toBe('red');
  });
});

describe('Button', () => {
  afterEach(() => (Haptics.impactAsync as jest.Mock).mockClear());

  it('is an accessible button that calls onPress with a haptic tap', async () => {
    const onPress = jest.fn();
    await render(<Button label="Create trip" accessibilityHint="Makes a new trip" onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Create trip' });
    expect(btn.props.accessibilityHint).toBe('Makes a new trip');
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('skips the haptic on web', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const onPress = jest.fn();
      await render(<Button label="Go" onPress={onPress} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
      expect(onPress).toHaveBeenCalled();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('shows a spinner, reports busy and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" loading onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.props.accessibilityState).toEqual({ busy: true });
    expect(screen.queryByText('Save')).toBeNull();
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('works without an onPress', async () => {
    await render(<Button label="Noop" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Noop' }));
  });

  it('fills primary buttons with the accent or a custom colour', async () => {
    await render(<Button label="A" />);
    expect(flat(screen.getByRole('button', { name: 'A' })).backgroundColor).toBe(light.accent);
    await render(<Button label="B" color="#123456" />);
    expect(flat(screen.getByRole('button', { name: 'B' })).backgroundColor).toBe('#123456');
    expect(flat(screen.getByText('B')).color).toBe(light.onColor);
  });

  it('styles secondary and ghost buttons', async () => {
    await render(<Button label="S" variant="secondary" />);
    expect(flat(screen.getByRole('button', { name: 'S' }))).toMatchObject({ backgroundColor: light.card, borderWidth: 1, borderColor: light.line });
    await render(<Button label="G" variant="ghost" icon={<RNText>★</RNText>} />);
    expect(flat(screen.getByRole('button', { name: 'G' })).backgroundColor).toBe('transparent');
    expect(screen.getByText('★')).toBeTruthy();
    expect(flat(screen.getByText('G')).color).toBe(light.text);
  });

  it('handles press in and out (press animation)', async () => {
    await render(<Button label="P" />);
    const btn = screen.getByRole('button', { name: 'P' });
    await fireEvent(btn, 'pressIn');
    await fireEvent(btn, 'pressOut');
  });
});

describe('Card', () => {
  it('renders children on the card colour and passes props through', async () => {
    await render(
      <Card testID="card" style={{ padding: 1 }}>
        <RNText>Inside</RNText>
      </Card>,
    );
    expect(screen.getByText('Inside')).toBeTruthy();
    expect(flat(screen.getByTestId('card'))).toMatchObject({ backgroundColor: light.card, borderColor: light.line, padding: 1 });
  });
});

describe('Screen', () => {
  it('renders content in a scroll view with a footer', async () => {
    await render(
      <Screen footer={<RNText>Footer</RNText>}>
        <RNText>Body</RNText>
      </Screen>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Footer')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('keyboardShouldPersistTaps');
  });

  it('can render without scrolling or a footer', async () => {
    await render(
      <Screen scroll={false}>
        <RNText>Body</RNText>
      </Screen>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('keyboardShouldPersistTaps');
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'mine', label: 'My days' },
    { value: 'all', label: 'Everyone' },
  ] as const;

  it('renders a tab per option and marks the selected one', async () => {
    await render(<Segmented options={[...options]} value="mine" onChange={jest.fn()} />);
    expect(screen.getByRole('tab', { name: 'My days' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('tab', { name: 'Everyone' }).props.accessibilityState).toEqual({ selected: false });
  });

  it('calls onChange with the pressed value', async () => {
    const onChange = jest.fn();
    await render(<Segmented options={[...options]} value="mine" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyone' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
