import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Glow, tap } from './src/theme';
import { HomeProvider, useHome } from './src/useHome';
import Splash from './src/Splash';
import Home from './src/Home';
import Timers from './src/Timers';
import Energy from './src/Energy';
import Settings from './src/Settings';
import AuthModal from './src/AuthModal';

SplashScreen.preventAutoHideAsync().catch(() => {});

const TABS = [
  { label: 'Home', icon: 'home', outline: 'home-outline', Screen: Home, color: '#FF9500' },
  { label: 'Timers', icon: 'timer', outline: 'timer-outline', Screen: Timers, color: '#06D6A0' },
  { label: 'Energy', icon: 'flash', outline: 'flash-outline', Screen: Energy, color: '#38BDF8' },
  { label: 'Settings', icon: 'settings', outline: 'settings-outline', Screen: Settings, color: '#8B5CF6' },
] as const;

/* ---------- floating tab bar with dynamic per-tab colors ---------- */
function TabButton({
  i,
  active,
  onPress,
  colors,
}: {
  i: number;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  const t = TABS[i];
  const bounce = useSharedValue(1);
  useEffect(() => {
    if (active) bounce.value = withSequence(withTiming(0.78, { duration: 90 }), withSpring(1, { damping: 6, stiffness: 180 }));
  }, [active]);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));
  const tabColor = active ? t.color : colors.dim;

  return (
    <Pressable style={s.tabBtn} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Animated.View style={icon}>
        <Ionicons name={(active ? t.icon : t.outline) as any} size={21} color={tabColor} />
      </Animated.View>
      <Text style={[s.tabLabel, { color: tabColor }, active && { fontWeight: '500' }]}>{t.label}</Text>
    </Pressable>
  );
}

function TabBar({
  tab,
  onChange,
  bottom,
  colors,
}: {
  tab: number;
  onChange: (i: number) => void;
  bottom: number;
  colors: any;
}) {
  const { width } = useWindowDimensions();
  const barW = width - 40;
  const tabW = (barW - 12) / TABS.length;
  const x = useSharedValue(tab * tabW);

  useEffect(() => {
    x.value = withSpring(tab * tabW, { damping: 16, stiffness: 180 });
  }, [tab, tabW]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const activeTabColor = TABS[tab]?.color || colors.lamp;

  return (
    <View
      style={[
        s.bar,
        {
          width: barW,
          bottom: bottom + 14,
          backgroundColor: colors.tabBg,
          borderColor: colors.tabLine,
        },
      ]}
    >
      <Animated.View
        style={[
          s.pill,
          {
            width: tabW,
            backgroundColor: `${activeTabColor}1E`,
            borderColor: `${activeTabColor}40`,
            borderWidth: 1,
          },
          pill,
        ]}
      />
      {TABS.map((_, i) => (
        <TabButton key={i} i={i} active={tab === i} onPress={() => onChange(i)} colors={colors} />
      ))}
    </View>
  );
}

/* ---------- main shell: ambient light + pages + tab bar ---------- */
function Shell() {
  const h = useHome();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const dir = useRef(1);

  const onCount = h.channels.filter((ch) => h.on[ch.id]).length;
  const glowP = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    glowP.value = withTiming(h.channels.length > 0 ? onCount / h.channels.length : 0, { duration: reduce ? 0 : 900 });
  }, [onCount, reduce, h.channels.length]);

  useEffect(() => {
    if (reduce) return;
    breathe.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce]);

  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(glowP.value, [0, 1], [h.colors.night, h.colors.warm]),
  }));
  const orbA = useAnimatedStyle(() => ({
    opacity: glowP.value * (0.65 + 0.25 * breathe.value),
    transform: [{ scale: 1 + 0.08 * breathe.value }],
  }));
  const orbB = useAnimatedStyle(() => ({
    opacity: glowP.value * (0.4 + 0.2 * (1 - breathe.value)),
  }));

  const Screen = TABS[tab].Screen;
  const Enter = dir.current > 0 ? FadeInRight : FadeInLeft;

  return (
    <Animated.View style={[s.fill, bg]}>
      {/* Ambient Glow Orbs */}
      <Animated.View pointerEvents="none" style={[s.orbA, orbA]}>
        <Glow id="orb-a" size={500} color="#FF9500" opacity={h.isDark ? 0.32 : 0.05} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[s.orbB, orbB]}>
        <Glow id="orb-b" size={420} color="#06D6A0" opacity={h.isDark ? 0.25 : 0.04} />
      </Animated.View>

      {/* each page slides in from the side you're navigating towards */}
      <Animated.View
        key={tab}
        entering={Enter.duration(300)}
        exiting={FadeOut.duration(140)}
        style={[StyleSheet.absoluteFill, { top: insets.top }]}
      >
        <Screen />
      </Animated.View>

      <TabBar
        tab={tab}
        bottom={insets.bottom}
        colors={h.colors}
        onChange={(i) => {
          if (i === tab) return;
          dir.current = i > tab ? 1 : -1;
          tap();
          setTab(i);
        }}
      />

      <AuthModal visible={h.authModalOpen} onClose={h.closeAuthModal} canDismiss={true} />
    </Animated.View>
  );
}

/* ---------- root: splash plays while MQTT connects in the background ---------- */
function Root() {
  const { isDark, colors } = useHome();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    // Dismiss native splash screen smoothly on JS mount
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={[s.fill, { backgroundColor: colors.night }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!splash && <Shell />}
      {splash && (
        <Animated.View exiting={FadeOut.duration(400)} style={StyleSheet.absoluteFill}>
          <Splash onFinish={() => setSplash(false)} />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <HomeProvider>
        <Root />
      </HomeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  orbA: { position: 'absolute', top: -170, right: -190 },
  orbB: { position: 'absolute', bottom: -160, left: -170 },
  bar: {
    position: 'absolute',
    left: 20,
    height: 64,
    borderRadius: 32,
    padding: 6,
    flexDirection: 'row',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  pill: {
    position: 'absolute',
    left: 6,
    top: 6,
    height: 50,
    borderRadius: 25,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11 },
});
