import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Glow } from './theme';
import { useHome } from './useHome';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const LEN = 340; // length of the house outline

export default function Splash({ onFinish }: { onFinish: () => void }) {
  const { brokerUp, deviceUp, ready, colors } = useHome();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const draw = useSharedValue(0);
  const lamp = useSharedValue(0);
  const sweep = useSharedValue(0);
  const [minDone, setMinDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // 1) house outline is drawn, 2) bulb lights up, 3) progress bar sweeps smoothly
    draw.value = withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) });
    lamp.value = withDelay(950, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    sweep.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false);

    const a = setTimeout(() => setMinDone(true), 1100);
    const b = setTimeout(() => setTimedOut(true), 2600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  useEffect(() => {
    if (minDone && (ready || timedOut)) {
      onFinish();
    }
  }, [minDone, ready, timedOut, onFinish]);

  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: LEN * (1 - draw.value) }));
  const lampStyle = useAnimatedStyle(() => ({
    opacity: lamp.value,
    transform: [{ scale: lamp.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: lamp.value,
    transform: [{ scale: 0.6 + 0.4 * lamp.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -80 + sweep.value * 280 }],
  }));

  const status = timedOut && !ready
    ? 'Starting without a connection'
    : !brokerUp
    ? 'Connecting to your home…'
    : !deviceUp
    ? 'Waking up your switches…'
    : 'All set';

  return (
    <View
      style={[
        s.screen,
        {
          width,
          height,
          backgroundColor: colors.night,
          paddingTop: insets.top + 30,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        },
      ]}
    >
      {/* Top spacer for optical balance */}
      <View style={{ height: 20 }} />

      {/* Center Hero Block */}
      <View style={s.centerBlock}>
        <View style={s.logo}>
          <Animated.View pointerEvents="none" style={[s.halo, haloStyle]}>
            <Glow id="splash-halo" size={320} color={colors.lamp} opacity={colors.night === '#0B101B' ? 0.55 : 0.35} />
          </Animated.View>

          <Svg width={140} height={140} viewBox="0 0 140 140">
            <AnimatedPath
              d="M20 70 L70 25 L120 70 V120 H20 Z"
              stroke={colors.text}
              strokeWidth={4.5}
              strokeDasharray={LEN}
              animatedProps={pathProps}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>

          <Animated.View
            style={[
              s.bulb,
              {
                backgroundColor: colors.lamp,
                shadowColor: colors.lamp,
                shadowOpacity: 0.8,
                shadowRadius: 14,
                elevation: 6,
              },
              lampStyle,
            ]}
          />
        </View>

        <Animated.Text
          entering={FadeInDown.delay(700).duration(600)}
          style={[s.name, { color: colors.text }]}
        >
          L U M O
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(850).duration(500)}
          style={[s.subName, { color: colors.dim }]}
        >
          Smart Home Control
        </Animated.Text>
      </View>

      {/* Bottom Loader Block */}
      <Animated.View entering={FadeIn.delay(1100).duration(500)} style={s.loader}>
        <View style={[s.track, { backgroundColor: colors.chipBg, borderColor: colors.line, borderWidth: 1 }]}>
          <Animated.View style={[s.bar, { backgroundColor: colors.lamp }, barStyle]} />
        </View>
        <Animated.Text
          key={status}
          entering={FadeIn.duration(300)}
          style={[s.status, { color: colors.dim }]}
        >
          {status}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    left: -90,
    top: -90,
  },
  bulb: {
    position: 'absolute',
    left: 59,
    top: 77,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  name: {
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: 10,
    marginTop: 28,
    textAlign: 'center',
    paddingLeft: 10,
  },
  subName: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  loader: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  track: {
    width: 200,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    width: 80,
    height: 4,
    borderRadius: 2,
  },
  status: {
    fontSize: 14,
    marginTop: 14,
    fontWeight: '400',
  },
});
