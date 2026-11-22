import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text as RNText, StyleSheet } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { iconPaths } from '@/components/ui/icon-paths';
import { IconButton } from '@/components/ui/icon-button';
import { IconTile } from '@/components/ui/icon-tile';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { Wordmark } from '@/components/ui/wordmark';
import { palette, tripColors, tripTints } from '@/theme/tokens';

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

  it.each(['hero', 'display', 'title', 'titleSm', 'heading'] as const)('marks the %s variant as a header', async (variant) => {
    await render(<Text variant={variant}>Head</Text>);
    expect(screen.getByRole('header', { name: 'Head' }).props.maxFontSizeMultiplier).toBe(1.4);
  });

  it.each([
    ['secondary', light.textSecondary],
    ['muted', light.textMuted],
    ['iris', light.irisText],
    ['positive', light.positive],
    ['owe', light.owe],
    ['onIris', light.onIris],
    ['onBeak', light.onBeak],
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

  it('fills primary buttons with iris, a 56pt pill by default', async () => {
    await render(<Button label="A" />);
    expect(flat(screen.getByRole('button', { name: 'A' }))).toMatchObject({ backgroundColor: light.iris, minHeight: 56, borderRadius: 28 });
    expect(flat(screen.getByText('A')).color).toBe(light.onIris);
  });

  it('picks readable text for a custom fill', async () => {
    await render(<Button label="B" color={tripColors.iris} />);
    expect(flat(screen.getByRole('button', { name: 'B' })).backgroundColor).toBe(tripColors.iris);
    expect(flat(screen.getByText('B')).color).toBe('#FFFFFF');
    await render(<Button label="C" color={tripColors.coral} />);
    expect(flat(screen.getByText('C')).color).toBe('#171A2F');
    await render(<Button label="D" color="#123456" />);
    expect(flat(screen.getByText('D')).color).toBe(light.onBeak);
  });

  it.each([
    ['md', 52, 26],
    ['sm', 44, 22],
  ] as const)('sizes %s buttons', async (size, height, r) => {
    await render(<Button label="Z" size={size} />);
    expect(flat(screen.getByRole('button', { name: 'Z' }))).toMatchObject({ minHeight: height, borderRadius: r });
  });

  it.each([
    ['ink', light.ink, light.onInk],
    ['beak', light.beak, light.onBeak],
  ] as const)('fills %s buttons', async (variant, bg, fg) => {
    await render(<Button label="V" variant={variant} />);
    expect(flat(screen.getByRole('button', { name: 'V' })).backgroundColor).toBe(bg);
    expect(flat(screen.getByText('V')).color).toBe(fg);
  });

  it('keeps beak buttons small', async () => {
    await render(<Button label="Nudge them" variant="beak" />);
    expect(flat(screen.getByRole('button', { name: 'Nudge them' })).minHeight).toBe(44);
  });

  it('draws the dashed suggest button with a plus, and a tall version', async () => {
    await render(<Button label="Suggest a place" variant="suggest" />);
    const btn = screen.getByRole('button', { name: 'Suggest a place' });
    expect(flat(btn)).toMatchObject({ backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderColor: light.dashed, minHeight: 52 });
    expect(flat(screen.getByText('Suggest a place')).color).toBe(light.irisText);
    await render(<Button label="Add photos" variant="suggest" tall icon="camera" />);
    expect(flat(screen.getByRole('button', { name: 'Add photos' })).minHeight).toBe(110);
  });

  it('draws an ink outline for outlineInk', async () => {
    await render(<Button label="Add to calendar" variant="outlineInk" iconRight="arrowRight" />);
    expect(flat(screen.getByRole('button', { name: 'Add to calendar' }))).toMatchObject({ backgroundColor: 'transparent', borderWidth: 2, borderColor: light.ink });
  });

  it('styles outline (secondary) and ghost buttons', async () => {
    await render(<Button label="S" variant="secondary" />);
    expect(flat(screen.getByRole('button', { name: 'S' }))).toMatchObject({ backgroundColor: light.card, borderWidth: 1, borderColor: light.lineStrong });
    await render(<Button label="O" variant="outline" />);
    expect(flat(screen.getByRole('button', { name: 'O' }))).toMatchObject({ backgroundColor: light.card, borderColor: light.lineStrong });
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
    expect(flat(screen.getByTestId('card'))).toMatchObject({ backgroundColor: light.card, borderColor: light.line, borderRadius: 24, padding: 1 });
  });

  it('draws a borderless hero card in a colour', async () => {
    await render(<Card testID="hero" variant="hero" color={light.beak} />);
    const style = flat(screen.getByTestId('hero'));
    expect(style).toMatchObject({ backgroundColor: light.beak, borderRadius: 28, padding: 20 });
    expect(style.borderWidth).toBeUndefined();
  });

  it('can be one pressable row with a chevron', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} chevron accessibilityLabel="Goa getaway">
        <RNText>Goa getaway</RNText>
      </Card>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Goa getaway' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Icon', () => {
  it('draws every icon in the set', async () => {
    for (const name of Object.keys(iconPaths) as (keyof typeof iconPaths)[]) {
      await render(<Icon name={name} testID={`icon-${name}`} />);
      expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
    }
  });
});

describe('IconButton', () => {
  it('is a 44pt labelled button in card or iris', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="back" accessibilityLabel="Back to trips" onPress={onPress} />);
    const back = screen.getByRole('button', { name: 'Back to trips' });
    await fireEvent.press(back);
    expect(onPress).toHaveBeenCalled();
    expect(flat(back)).toMatchObject({ width: 44, height: 44, borderRadius: 22, backgroundColor: light.card, borderColor: light.line });
    await render(<IconButton icon="plus" variant="iris" accessibilityLabel="Invite people" />);
    expect(flat(screen.getByRole('button', { name: 'Invite people' })).backgroundColor).toBe(light.iris);
  });
});

describe('IconTile', () => {
  it('fills with the area tint, in two sizes', async () => {
    await render(<IconTile area="split" icon="split" style={{ margin: 1 }} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain(light.tint.split);
    await render(<IconTile area="trip" size="lg"><RNText>12</RNText></IconTile>);
    expect(screen.getByText('12', { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"width":64');
  });
});

describe('Badge', () => {
  it.each([
    ['vote', light.tint.vote, light.irisText],
    ['beak', light.beak, light.onBeak],
    ['neutral', light.bg, light.textSecondary],
    ['beakSm', light.beak, light.onBeak],
  ] as const)('shows the %s tone', async (tone, bg, fg) => {
    await render(<Badge label="Planning days" tone={tone} />);
    const text = screen.getByText('Planning days');
    expect(flat(text).color).toBe(fg);
    expect(JSON.stringify(screen.toJSON())).toContain(bg);
  });
});

describe('Chip', () => {
  it('fills ink when selected and reports it', async () => {
    const onPress = jest.fn();
    await render(<Chip label="All" selected onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'All' });
    expect(chip).toBeSelected();
    expect(flat(chip).backgroundColor).toBe(light.ink);
    expect(flat(screen.getByText('All')).color).toBe(light.onInk);
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
    await render(<Chip label="Food" />);
    expect(flat(screen.getByRole('button', { name: 'Food' })).backgroundColor).toBe(light.card);
  });
});

describe('Avatar', () => {
  it('shows an ink initial on the colour tint, mapping old colour keys', async () => {
    await render(<Avatar name="meera" color="plum" size={34} ring={light.bg} />);
    expect(screen.getByText('M', { includeHiddenElements: true })).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain(tripTints.iris);
    expect(tree).toContain('"borderWidth":2');
    await render(<Avatar name="Zoe" color="mint" />);
    expect(JSON.stringify(screen.toJSON())).toContain(tripTints.mint);
  });

  it('falls back to the given colour without a choice', async () => {
    await render(<Avatar name="Kiran" fallbackColor="#ABCDEF" size={44} />);
    expect(JSON.stringify(screen.toJSON())).toContain('#ABCDEF');
    expect(flat(screen.getByText('K', { includeHiddenElements: true })).fontSize).toBe(16);
  });
});

describe('AvatarStack', () => {
  const people = ['Maya', 'Arjun', 'Zara', 'Kabir', 'Isha'].map((name) => ({ name }));

  it('overlaps avatars and sums the rest into a +N chip', async () => {
    await render(<AvatarStack people={people} max={3} />);
    for (const i of ['M', 'A', 'Z']) expect(screen.getByText(i, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('K', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('+2', { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"marginLeft":-8');
  });

  it('shows everyone without a max', async () => {
    await render(<AvatarStack people={people} />);
    expect(screen.queryByText(/^\+/, { includeHiddenElements: true })).toBeNull();
  });
});

describe('Input', () => {
  it('labels the field and shows errors', async () => {
    const onChangeText = jest.fn();
    await render(<Input label="What should we call it?" value="" onChangeText={onChangeText} error="Give it a name" />);
    const field = screen.getByLabelText('What should we call it?');
    await fireEvent.changeText(field, 'Goa');
    expect(onChangeText).toHaveBeenCalledWith('Goa');
    expect(flat(field)).toMatchObject({ borderColor: light.danger, minHeight: 56, borderRadius: 20 });
    expect(screen.getByText('Give it a name')).toBeTruthy();
  });

  it('rings the field in iris while focused', async () => {
    await render(<Input label="Name" />);
    const field = screen.getByLabelText('Name');
    expect(flat(field)).toMatchObject({ borderWidth: 1, borderColor: light.lineStrong });
    await fireEvent(field, 'focus');
    expect(flat(screen.getByLabelText('Name'))).toMatchObject({ borderWidth: 2, borderColor: light.iris });
    await fireEvent(screen.getByLabelText('Name'), 'blur');
    expect(flat(screen.getByLabelText('Name')).borderWidth).toBe(1);
  });
});

describe('SpeechCard', () => {
  it('leads with "Pip says" and offers one action', async () => {
    await render(<SpeechCard action={<Button label="Plan" size="sm" />}>Day 4 and 5 are still empty.</SpeechCard>);
    expect(screen.getByText('Pip says')).toBeTruthy();
    expect(screen.getByText(/Day 4 and 5 are still empty/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"borderBottomLeftRadius":6');
  });
});

describe('ProgressBar', () => {
  it('fills to the value and clamps', async () => {
    await render(<ProgressBar value={0.8} accessibilityLabel="4 of 5 voted" />);
    const bar = screen.getByLabelText('4 of 5 voted');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 80 });
    expect(flat(screen.getByTestId('progress-fill')).width).toBe('80%');
    await render(<ProgressBar value={3} accessibilityLabel="over" />);
    expect(screen.getByLabelText('over').props.accessibilityValue.now).toBe(100);
  });
});

describe('Wordmark', () => {
  it('is a lower-case header named Huddle with -4% tracking', async () => {
    await render(<Wordmark size={48} />);
    const mark = screen.getByRole('header', { name: 'Huddle' });
    expect(flat(mark)).toMatchObject({ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 48, letterSpacing: -1.92, color: light.text });
    await render(<Wordmark size={52} tone="white" />);
    expect(flat(screen.getByRole('header', { name: 'Huddle' })).color).toBe('#FFFFFF');
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

  it('pads tab screens clear of the floating nav', async () => {
    await render(
      <Screen withNav contentStyle={{ margin: 1 }}>
        <RNText>Body</RNText>
      </Screen>,
    );
    expect(JSON.stringify(screen.toJSON())).toContain('"paddingBottom":100');
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
    expect(JSON.stringify(screen.toJSON())).toContain(`"backgroundColor":"${light.track}"`);
    expect(flat(screen.getByRole('tab', { name: 'My days' })).backgroundColor).toBe(light.card);
    expect(screen.getByRole('tab', { name: 'My days' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Everyone' })).not.toBeSelected();
  });

  it('calls onChange with the pressed value', async () => {
    const onChange = jest.fn();
    await render(<Segmented options={[...options]} value="mine" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyone' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
