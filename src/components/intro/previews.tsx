import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { radius, space, tripColors, type TintArea } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** The tinted frame around each preview. Decorative: the page's title and Pip's line say what it shows. */
function Frame({ area, children }: { area: TintArea; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.frame, { backgroundColor: colors.tint[area] }]}>
      {children}
    </View>
  );
}

function Panel({ children, style }: { children: ReactNode; style?: object }) {
  const { colors } = useTheme();
  return <View style={[styles.panel, { backgroundColor: colors.card }, style]}>{children}</View>;
}

function Chip({ label, on }: { label: string; on?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: on ? colors.ink : colors.card }]}>
      <Text variant="badge" style={{ color: on ? colors.onInk : colors.text }}>
        {label}
      </Text>
    </View>
  );
}

function Row({ icon, iconBg, title, detail }: { icon: IconName; iconBg: string; title: string; detail: string }) {
  return (
    <Panel style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={18} color="#171A2F" />
      </View>
      <View style={styles.flex}>
        <Text variant="calloutStrong">{title}</Text>
        <Text variant="caption" tone="secondary">
          {detail}
        </Text>
      </View>
    </Panel>
  );
}

const DAYS = [
  { day: 9, heat: 0 },
  { day: 10, heat: 1 },
  { day: 11, heat: 2 },
  { day: 12, heat: 3 },
  { day: 13, heat: 3 },
  { day: 14, heat: 3 },
  { day: 15, heat: 1 },
];

export function VotePreview() {
  const { colors } = useTheme();
  return (
    <Frame area="vote">
      <Panel>
        <View style={styles.between}>
          <Text variant="calloutStrong">Dates</Text>
          <Text variant="caption" tone="secondary">
            Dec 2026
          </Text>
        </View>
        <View style={styles.week}>
          {DAYS.map((d) => (
            <View key={d.day} style={[styles.day, { backgroundColor: colors.heat[d.heat] }]}>
              <Text variant="badge" style={{ color: d.heat === 3 ? colors.onIris : d.heat === 0 ? colors.textSecondary : colors.text }}>
                {d.day}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="badge" tone="iris">
          Best days: Sat 12 – Mon 14 · 6 of 6 free
        </Text>
      </Panel>
      <Panel>
        <View style={styles.place}>
          <View style={styles.placeHead}>
            <Text variant="calloutStrong">Manali</Text>
            <Badge label="Leading" tone="beakSm" />
            <Text variant="numberXs" style={styles.push}>
              4
            </Text>
          </View>
          <ProgressBar value={0.8} />
        </View>
        <View style={styles.place}>
          <View style={styles.placeHead}>
            <Text variant="calloutStrong">Coorg</Text>
            <Text variant="numberXs" style={styles.push}>
              2
            </Text>
          </View>
          <ProgressBar value={0.4} />
        </View>
      </Panel>
    </Frame>
  );
}

const PLANS = [
  { time: '09:00', what: 'Breakfast at the cafe' },
  { time: '13:00', what: 'Solang valley' },
  { time: '20:00', what: 'Bonfire at the stay' },
];

export function PlanPreview() {
  const { colors } = useTheme();
  return (
    <Frame area="plan">
      <View style={styles.chips}>
        <Chip label="Sat 12" on />
        <Chip label="Sun 13" />
        <Chip label="Mon 14" />
      </View>
      <Panel style={styles.list}>
        {PLANS.map((p, i) => (
          <View key={p.time} style={[styles.line, i < PLANS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <Text variant="calloutStrong" tone="owe" style={styles.time}>
              {p.time}
            </Text>
            <Text variant="calloutStrong">{p.what}</Text>
          </View>
        ))}
      </Panel>
      <Row icon="clock" iconBg="#FFF1CC" title="Hangout: dinner Thursday?" detail="College gang · 4 of 5 answered" />
    </Frame>
  );
}

const BALANCES = [
  { name: 'Zoe', color: 'blush', text: 'Zoe owes you', amount: '₹1,200', owed: true },
  { name: 'Kabir', color: 'beak', text: 'Kabir owes you', amount: '₹1,200', owed: true },
  { name: 'Arjun', color: 'iris', text: 'You owe Arjun', amount: '₹800', owed: false },
];

export function SplitPreview() {
  const { colors } = useTheme();
  return (
    <Frame area="split">
      <Panel>
        <Text variant="caption" tone="secondary">
          You get back
        </Text>
        <Text variant="title" tone="positive" accessibilityRole="text">
          ₹1,600
        </Text>
      </Panel>
      <Panel style={styles.list}>
        {BALANCES.map((b, i) => (
          <View key={b.name} style={[styles.line, styles.center, i < BALANCES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <Avatar name={b.name} color={b.color} size={28} />
            <Text variant="callout" style={styles.flex}>
              {b.text}
            </Text>
            <Text variant="calloutStrong" tone={b.owed ? 'positive' : 'owe'}>
              {b.amount}
            </Text>
          </View>
        ))}
      </Panel>
      <Row icon="split" iconBg="#DDF5EE" title="Cabs to Solang · ₹1,800" detail="Paid by you · split 6 ways" />
    </Frame>
  );
}

export function PhotosPreview() {
  const { colors } = useTheme();
  return (
    <Frame area="photos">
      <View style={styles.chips}>
        <Chip label="All" on />
        <Chip label="Day 1" />
        <Chip label="Day 2" />
        <Chip label="Mine" />
      </View>
      <View style={styles.grid}>
        <View style={[styles.tile, styles.tall, { backgroundColor: tripColors.iris }]}>
          <Icon name="mountain" size={34} color="#FFFFFF" />
        </View>
        <View style={styles.gridCol}>
          <View style={styles.gridRow}>
            <View style={[styles.tile, styles.flex, { backgroundColor: tripColors.beak }]}>
              <Icon name="coffee" size={24} color="#171A2F" />
            </View>
            <View style={[styles.tile, styles.flex, { backgroundColor: tripColors.mint }]}>
              <Icon name="stay" size={24} color="#171A2F" />
            </View>
          </View>
          <View style={[styles.tile, { backgroundColor: tripColors.coral }]}>
            <Icon name="dinner" size={24} color="#171A2F" />
          </View>
        </View>
      </View>
      <Panel style={styles.row}>
        <View style={styles.faces}>
          {[
            { name: 'Arjun', color: 'iris' },
            { name: 'Zoe', color: 'blush' },
            { name: 'Kabir', color: 'beak' },
          ].map((p, i) => (
            <Avatar key={p.name} name={p.name} color={p.color} size={28} ring={colors.card} style={i > 0 ? styles.overlap : undefined} />
          ))}
        </View>
        <Text variant="calloutStrong">48 photos from 6 people</Text>
      </Panel>
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.xl, padding: space.s18, gap: space.md },
  panel: { borderRadius: radius.lg, paddingVertical: space.s14, paddingHorizontal: space.lg, gap: space.s10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  week: { flexDirection: 'row', gap: space.s6 },
  day: { flex: 1, height: 34, borderRadius: radius.badge, alignItems: 'center', justifyContent: 'center' },
  place: { gap: space.s6 },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  push: { marginLeft: 'auto' },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: { height: 34, paddingHorizontal: space.s14, borderRadius: radius.pill, justifyContent: 'center' },
  list: { paddingVertical: space.xs, gap: 0 },
  line: { flexDirection: 'row', gap: space.s14, paddingVertical: space.s10 },
  center: { alignItems: 'center', gap: space.s10 },
  time: { width: 46 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', gap: space.sm, height: 128 },
  gridCol: { flex: 2, gap: space.sm },
  gridRow: { flex: 1, flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tall: { flex: 1 },
  faces: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
});
