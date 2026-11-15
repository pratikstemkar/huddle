import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';
import { iconPaths, type IconDef, type IconName } from './icon-paths';

export type { IconName } from './icon-paths';

type Props = {
  name: IconName;
  size?: number;
  /** Stroke colour, or fill for brand glyphs. Defaults to the text colour. */
  color?: string;
  strokeWidth?: number;
  testID?: string;
};

/** A line icon from the Huddle set. Decorative: label the control that holds it. */
export function Icon({ name, size = 22, color, strokeWidth, testID }: Props) {
  const { colors } = useTheme();
  const def: IconDef = iconPaths[name];
  const tint = color ?? colors.text;
  const stroke = def.filled ? undefined : tint;
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={def.filled ? tint : 'none'}
      stroke={stroke}
      strokeWidth={def.filled ? undefined : (strokeWidth ?? def.strokeWidth ?? 2)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      pointerEvents="none">
      {def.shapes.map((s, i) => {
        if (s.t === 'path') return <Path key={i} d={s.d} fill={s.fill} />;
        if (s.t === 'rect') return <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />;
        return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
      })}
    </Svg>
  );
}
