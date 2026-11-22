import { Switch, type SwitchProps } from 'react-native';

import { useTheme } from '@/theme/use-theme';

type Props = Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'>;

/**
 * The app's on/off switch. Always use this instead of React Native's `Switch`: left alone, Android
 * paints the knob its own teal accent and the web paints it teal when on, which clashes with the iris track.
 */
export function Toggle(props: Props) {
  const { colors } = useTheme();
  const web = { activeThumbColor: colors.thumb } as object;
  return (
    <Switch
      trackColor={{ true: colors.iris, false: colors.lineStrong }}
      thumbColor={colors.thumb}
      ios_backgroundColor={colors.lineStrong}
      {...web}
      {...props}
    />
  );
}
