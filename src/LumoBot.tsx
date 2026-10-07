import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Press, notify, tap } from './theme';
import { useHome } from './useHome';

interface LumoBotProps {
  compact?: boolean;
}

export default function LumoBot({ compact = false }: LumoBotProps) {
  const { on, timerEnd, now, ready, names, isDark, colors } = useHome();
  const reduce = useReducedMotion();

  const onCount = Object.values(on).filter(Boolean).length;
  const anyTimer = Object.values(timerEnd).some((end) => end && end > now);
  const isSleeping = onCount === 0 && !anyTimer;

  // Interaction mood states: 'normal' | 'happy' | 'wink' | 'sleep' | 'focus'
  const [mood, setMood] = useState<'normal' | 'happy' | 'wink' | 'sleep' | 'focus'>('normal');
  const [bubbleText, setBubbleText] = useState('');

  // 3D physics floating & tilting shared values
  const floatY = useSharedValue(0);
  const headTilt = useSharedValue(0);
  const headScale = useSharedValue(1);
  const shadowScale = useSharedValue(1);
  const eyeBlink = useSharedValue(1);
  const earGlow = useSharedValue(0);
  const zzzFloat1 = useSharedValue(0);
  const zzzFloat2 = useSharedValue(0);

  // Floating levitation loop
  useEffect(() => {
    if (reduce) return;
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    shadowScale.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [reduce]);

  // Periodic eye blinking when awake
  useEffect(() => {
    if (isSleeping || reduce) return;
    const interval = setInterval(() => {
      eyeBlink.value = withSequence(
        withTiming(0.1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) })
      );
    }, 3800);
    return () => clearInterval(interval);
  }, [isSleeping, reduce]);

  // Floating Zzz animation when sleeping
  useEffect(() => {
    if (!isSleeping || reduce) return;
    zzzFloat1.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    const t = setTimeout(() => {
      zzzFloat2.value = withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    }, 1100);
    return () => clearTimeout(t);
  }, [isSleeping, reduce]);

  // Update bot state & speech bubble dynamically based on smart home status
  useEffect(() => {
    if (!ready) {
      setMood('normal');
      setBubbleText('Connecting to switches...');
    } else if (anyTimer) {
      setMood('focus');
      setBubbleText('Timer active! I will auto-stop it ⏱️');
    } else if (onCount === 0) {
      setMood('sleep');
      setBubbleText('All switches off. Resting now... Zzz');
    } else if (onCount === 1) {
      setMood('happy');
      setBubbleText('1 switch active! Room is lit ✨');
    } else {
      setMood('happy');
      setBubbleText('All switches ON! Full power 💡');
    }
  }, [onCount, anyTimer, ready]);

  // Accent color of the bot's eyes and ear pods
  const accentColor = !ready
    ? '#94A3B8'
    : anyTimer
    ? '#38BDF8'
    : onCount > 0
    ? '#FF9F1C'
    : '#8B5CF6';

  // Interactive tap on the bot
  const handlePoke = () => {
    tap();
    headScale.value = withSequence(
      withTiming(0.9, { duration: 90 }),
      withSpring(1.08, { damping: 4, stiffness: 220 }),
      withSpring(1, { damping: 8, stiffness: 180 })
    );
    headTilt.value = withSequence(
      withTiming(12, { duration: 120 }),
      withTiming(-10, { duration: 140 }),
      withSpring(0, { damping: 6 })
    );

    // Fun interactive reactions
    const funMoods = ['wink', 'happy'] as const;
    const randomMood = funMoods[Math.floor(Math.random() * funMoods.length)];
    setMood(randomMood);

    const funQuotes = [
      'Hi there! Looking sharp today! 🤖',
      'Everything is running smoothly! ✨',
      'Need anything? Just tap a switch! ⚡',
      'Smart home secured & active! 🛡️',
      'Lumo Bot online & ready! 🚀',
    ];
    setBubbleText(funQuotes[Math.floor(Math.random() * funQuotes.length)]);

    setTimeout(() => {
      setMood(isSleeping ? 'sleep' : onCount > 0 ? 'happy' : 'normal');
    }, 2800);
  };

  const botAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotateZ: `${headTilt.value}deg` },
      { scale: headScale.value },
    ],
  }));

  const shadowAnim = useAnimatedStyle(() => ({
    transform: [{ scale: shadowScale.value }],
    opacity: 0.35 + 0.15 * (1 - shadowScale.value),
  }));

  const eyeScale = useAnimatedStyle(() => ({
    transform: [{ scaleY: mood === 'sleep' ? 0.2 : eyeBlink.value }],
  }));

  const zzzStyle1 = useAnimatedStyle(() => ({
    opacity: (1 - zzzFloat1.value) * 0.9,
    transform: [
      { translateY: -zzzFloat1.value * 28 },
      { translateX: zzzFloat1.value * 14 },
      { scale: 0.7 + 0.5 * zzzFloat1.value },
    ],
  }));

  const zzzStyle2 = useAnimatedStyle(() => ({
    opacity: (1 - zzzFloat2.value) * 0.9,
    transform: [
      { translateY: -zzzFloat2.value * 32 },
      { translateX: zzzFloat2.value * 18 },
      { scale: 0.6 + 0.5 * zzzFloat2.value },
    ],
  }));

  return (
    <View style={[s.container, compact && s.compactContainer]}>
      {/* Interactive Mascot Area */}
      <Press onPress={handlePoke} style={s.botWrapper}>
        <View style={s.canvas}>
          {/* Floating Zzz for Sleep Mode */}
          {mood === 'sleep' && (
            <View style={s.zzzContainer}>
              <Animated.Text style={[s.zzzText, { color: accentColor }, zzzStyle1]}>Z</Animated.Text>
              <Animated.Text style={[s.zzzText, { color: accentColor }, zzzStyle2]}>z</Animated.Text>
            </View>
          )}

          {/* 3D Rendered Glossy Robot Body & Head */}
          <Animated.View style={[s.botBody, botAnim]}>
            <Svg width={110} height={110} viewBox="0 0 110 110">
              <Defs>
                {/* 3D Shell Radial Shading */}
                <RadialGradient id="shellGrad" cx="38%" cy="32%" r="65%">
                  <Stop offset="0%" stopColor={isDark ? '#F8FAFC' : '#FFFFFF'} />
                  <Stop offset="45%" stopColor={isDark ? '#E2E8F0' : '#F1F5F9'} />
                  <Stop offset="85%" stopColor={isDark ? '#94A3B8' : '#CBD5E1'} />
                  <Stop offset="100%" stopColor={isDark ? '#475569' : '#94A3B8'} />
                </RadialGradient>

                {/* Dark Glossy Visor */}
                <LinearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#0B132B" />
                  <Stop offset="50%" stopColor="#1C2541" />
                  <Stop offset="100%" stopColor="#0B132B" />
                </LinearGradient>

                {/* Glass Light Reflection Arc */}
                <LinearGradient id="glassReflect" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                  <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>

                {/* Glowing Ear Pod Light */}
                <RadialGradient id="earPodGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={accentColor} stopOpacity="1" />
                  <Stop offset="70%" stopColor={accentColor} stopOpacity="0.6" />
                  <Stop offset="100%" stopColor={accentColor} stopOpacity="0.1" />
                </RadialGradient>
              </Defs>

              {/* Antenna Top Node */}
              <Path d="M 55 18 L 55 8" stroke={isDark ? '#CBD5E1' : '#94A3B8'} strokeWidth={3} strokeLinecap="round" />
              <Circle cx={55} cy={7} r={5} fill="url(#earPodGlow)" />
              <Circle cx={55} cy={7} r={2.5} fill="#FFFFFF" />

              {/* Left & Right Glowing Headphone Pods */}
              <Circle cx={12} cy={55} r={8} fill={isDark ? '#334155' : '#E2E8F0'} />
              <Circle cx={12} cy={55} r={5.5} fill="url(#earPodGlow)" />
              <Circle cx={98} cy={55} r={8} fill={isDark ? '#334155' : '#E2E8F0'} />
              <Circle cx={98} cy={55} r={5.5} fill="url(#earPodGlow)" />

              {/* 3D Spherical Head Shell */}
              <Circle cx={55} cy={55} r={40} fill="url(#shellGrad)" />

              {/* Inner Dark Glass Visor Screen */}
              <Rect x={24} y={38} width={62} height={34} rx={17} fill="url(#visorGrad)" />

              {/* Visor Glass Highlight Arc (Glossy 3D reflection) */}
              <Path
                d="M 28 44 C 42 38, 68 38, 82 44 C 80 40, 70 39, 55 39 C 40 39, 30 40, 28 44 Z"
                fill="url(#glassReflect)"
              />

              {/* Left Eye */}
              {mood === 'sleep' ? (
                // Sleeping closed eye arc
                <Path d="M 37 57 Q 44 63 51 57" stroke={accentColor} strokeWidth={3.5} strokeLinecap="round" fill="none" />
              ) : mood === 'wink' ? (
                // Winking eye
                <Path d="M 37 57 Q 44 50 51 57" stroke={accentColor} strokeWidth={3.5} strokeLinecap="round" fill="none" />
              ) : mood === 'happy' ? (
                // Happy curved eye
                <Path d="M 37 57 Q 44 49 51 57" stroke={accentColor} strokeWidth={3.5} strokeLinecap="round" fill="none" />
              ) : (
                // Normal glowing oval eye
                <Ellipse cx={44} cy={55} rx={5} ry={7} fill={accentColor} />
              )}

              {/* Right Eye */}
              {mood === 'sleep' ? (
                <Path d="M 59 57 Q 66 63 73 57" stroke={accentColor} strokeWidth={3.5} strokeLinecap="round" fill="none" />
              ) : mood === 'happy' ? (
                <Path d="M 59 57 Q 66 49 73 57" stroke={accentColor} strokeWidth={3.5} strokeLinecap="round" fill="none" />
              ) : (
                <Ellipse cx={66} cy={55} rx={5} ry={7} fill={accentColor} />
              )}

              {/* Cute Cheek Blushes on Happy/Awake */}
              {onCount > 0 && mood !== 'sleep' && (
                <>
                  <Circle cx={33} cy={64} r={3} fill="#F43F5E" opacity={0.5} />
                  <Circle cx={77} cy={64} r={3} fill="#F43F5E" opacity={0.5} />
                </>
              )}
            </Svg>
          </Animated.View>

          {/* Dynamic 3D Floor Shadow */}
          <Animated.View style={[s.botShadow, shadowAnim]}>
            <Svg width={70} height={14} viewBox="0 0 70 14">
              <Ellipse cx={35} cy={7} rx={30} ry={5} fill={isDark ? '#000000' : '#64748B'} opacity={isDark ? 0.6 : 0.22} />
            </Svg>
          </Animated.View>
        </View>
      </Press>

      {/* Neat Minimal Speech Bubble & Status */}
      <View style={s.speechArea}>
        <View style={s.speechHeadRow}>
          <View style={[s.nameBadge, { backgroundColor: `${accentColor}18` }]}>
            <View style={[s.nameDot, { backgroundColor: accentColor }]} />
            <Text style={[s.nameText, { color: accentColor }]}>LUMO BOT</Text>
          </View>
          <Text style={[s.tapHint, { color: colors.dim }]}>tap to interact</Text>
        </View>

        <View style={[s.speechBubble, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Ionicons
            name={
              mood === 'sleep'
                ? 'moon-outline'
                : anyTimer
                ? 'timer-outline'
                : onCount > 0
                ? 'sparkles'
                : 'chatbubble-ellipses-outline'
            }
            size={15}
            color={accentColor}
          />
          <Text style={[s.bubbleMessage, { color: colors.text }]} numberOfLines={2}>
            {bubbleText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  compactContainer: {
    paddingVertical: 6,
  },
  botWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: 100,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botBody: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botShadow: {
    position: 'absolute',
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zzzContainer: {
    position: 'absolute',
    top: 0,
    right: 8,
    zIndex: 10,
  },
  zzzText: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '800',
  },
  speechArea: {
    flex: 1,
    gap: 6,
  },
  speechHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  nameDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  nameText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '300',
  },
  speechBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleMessage: {
    flex: 1,
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
});
