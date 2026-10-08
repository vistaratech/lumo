import React, { useEffect } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeColors {
  night: string;
  warm: string;
  card: string;
  cardOn: string;
  line: string;
  lineOn: string;
  text: string;
  textSecondary: string;
  dim: string;
  dimmer: string;
  lamp: string;
  ember: string;
  cyan: string;
  purple: string;
  pink: string;
  blue: string;
  ok: string;
  bad: string;
  tabBg: string;
  tabLine: string;
  pillBg: string;
  surface: string;
  chipBg: string;
  trackOff: string;
}

export const darkColors: ThemeColors = {
  night: '#080D18',
  warm: '#181216',
  card: '#121726',
  cardOn: '#251912',
  line: '#1E2538',
  lineOn: '#7C4B18',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  dim: '#94A3B8',
  dimmer: '#475569',
  lamp: '#FF9F1C',
  ember: '#FF5E1E',
  cyan: '#06D6A0',
  purple: '#A855F7',
  pink: '#F43F5E',
  blue: '#38BDF8',
  ok: '#10B981',
  bad: '#F43F5E',
  tabBg: 'rgba(18, 23, 38, 0.95)',
  tabLine: '#1E2538',
  pillBg: 'rgba(255, 159, 28, 0.18)',
  surface: '#182033',
  chipBg: 'rgba(255, 255, 255, 0.08)',
  trackOff: '#2A3550',
};

export const lightColors: ThemeColors = {
  night: '#F8FAFC',
  warm: '#FFF7ED',
  card: '#FFFFFF',
  cardOn: '#FFF7ED',
  line: '#E2E8F0',
  lineOn: '#FED7AA',
  text: '#0F172A',
  textSecondary: '#334155',
  dim: '#64748B',
  dimmer: '#94A3B8',
  lamp: '#EA580C',
  ember: '#F97316',
  cyan: '#0D9488',
  purple: '#7C3AED',
  pink: '#E11D48',
  blue: '#0284C7',
  ok: '#059669',
  bad: '#E11D48',
  tabBg: 'rgba(255, 255, 255, 0.96)',
  tabLine: '#E2E8F0',
  pillBg: 'rgba(234, 88, 12, 0.12)',
  surface: '#F1F5F9',
  chipBg: 'rgba(0, 0, 0, 0.05)',
  trackOff: '#CBD5E1',
};

export const C = darkColors;

/* ---------- haptics ---------- */
export const feel = { haptics: true };
export const tap = () => feel.haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const notify = (t: 'success' | 'error') =>
  feel.haptics &&
  Haptics.notificationAsync(
    t === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
  );

export const mmss = (t: number) => {
  const p = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h > 0 ? `${h}:${p(m)}:${p(t % 60)}` : `${p(m)}:${p(t % 60)}`;
};

/* ---------- soft radial glow ---------- */
export function Glow({
  id,
  size,
  color,
  opacity = 0.6,
}: {
  id: string;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.4} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

/* ---------- progress ring ---------- */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Ring({
  size,
  stroke,
  progress,
  color = C.lamp,
  duration = 900,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color?: string;
  duration?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const c = size / 2;
  const clamped = Math.min(1, Math.max(0, progress));

  if (Platform.OS === 'web') {
    const offset = len * (1 - clamped);
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={c} cy={c} r={r} stroke="rgba(128,128,128,0.15)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={offset}
            rotation="-90"
            origin={`${c}, ${c}`}
          />
        </Svg>
        {children}
      </View>
    );
  }

  const p = useSharedValue(progress);

  useEffect(() => {
    p.value = withTiming(clamped, { duration, easing: Easing.out(Easing.cubic) });
  }, [clamped, duration]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke="rgba(128,128,128,0.15)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={len}
          animatedProps={props}
          rotation="-90"
          origin={`${c}, ${c}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ---------- smooth-press wrapper ---------- */
export function Press({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));

  const flat = StyleSheet.flatten(style);
  const isFlex = flat && (flat.flex !== undefined || flat.flexGrow !== undefined);
  const pressableStyle: ViewStyle | undefined = isFlex
    ? {
        flex: flat.flex,
        flexGrow: flat.flexGrow,
        flexShrink: flat.flexShrink,
      }
    : undefined;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={pressableStyle}
      onPressIn={() => {
        sc.value = withTiming(0.97, { duration: 90, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        sc.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
      }}
    >
      <Animated.View style={[style, a, isFlex && { width: '100%' }, disabled && { opacity: 0.4 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- switch with custom active color ---------- */
const TRACK_W = 58;
export function Toggle({
  value,
  pending = false,
  colors = darkColors,
  activeColor,
}: {
  value: boolean;
  pending?: boolean;
  colors?: ThemeColors;
  activeColor?: string;
}) {
  const targetColor = activeColor || colors.lamp;
  const p = useSharedValue(value ? 1 : 0);
  const pend = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [value]);

  useEffect(() => {
    pend.value = withTiming(pending ? 1 : 0, { duration: 180 });
  }, [pending]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.trackOff, targetColor]),
  }));

  const thumb = useAnimatedStyle(() => {
    const w = 26 + 10 * pend.value;
    return { width: w, transform: [{ translateX: p.value * (TRACK_W - 8 - w) }] };
  });

  return (
    <Animated.View style={[st.track, track]}>
      <Animated.View style={[st.thumb, thumb]} />
    </Animated.View>
  );
}

/* ---------- connection pill with pulsing dot & click action ---------- */
export function StatusPill({
  label,
  good,
  colors = darkColors,
  onPress,
}: {
  label: string;
  good: boolean;
  colors?: ThemeColors;
  onPress?: () => void;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (good) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      pulse.value = withTiming(0);
    }
  }, [good]);

  const ring = useAnimatedStyle(() => ({
    opacity: good ? 0.7 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 2.2 }],
  }));

  const color = good ? colors.ok : colors.bad;

  const content = (
    <View style={[st.pill, { backgroundColor: colors.chipBg, borderColor: colors.line, borderWidth: 1 }]}>
      <View style={st.dotWrap}>
        <Animated.View style={[st.dotRing, { backgroundColor: color }, ring]} />
        <View style={[st.dot, { backgroundColor: color }]} />
      </View>
      <Text style={[st.pillText, { color: colors.text }]}>{label}</Text>
      {onPress && (
        <View style={st.pillActionIcon}>
          <Ionicons name="bluetooth" size={12} color={colors.dim} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Press onPress={onPress}>
        {content}
      </Press>
    );
  }

  return content;
}

/* ---------- page header with colorful icon badge ---------- */
export function Header({
  title,
  sub,
  colors = darkColors,
  badgeIcon,
  badgeColor,
}: {
  title: string;
  sub: string;
  colors?: ThemeColors;
  badgeIcon?: any;
  badgeColor?: string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(450)} style={st.header}>
      {badgeIcon && (
        <View style={[st.badge, { backgroundColor: badgeColor ? `${badgeColor}20` : `${colors.lamp}20`, borderColor: badgeColor || colors.lamp }]}>
          <Text style={{ fontSize: 16 }}>{badgeIcon}</Text>
        </View>
      )}
      <Text style={[st.headerTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[st.headerSub, { color: colors.dim }]}>{sub}</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -1.2,
  },
  headerSub: {
    fontSize: 15,
    marginTop: 4,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  track: { width: TRACK_W, height: 34, borderRadius: 17, padding: 4, justifyContent: 'center' },
  thumb: {
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  dotWrap: { width: 8, height: 8, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotRing: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  pillActionIcon: { marginLeft: 6, opacity: 0.8 },
});
