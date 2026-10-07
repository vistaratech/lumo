import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CHANNELS } from './config';
import { Glow, Press, Ring, Toggle, mmss, tap } from './theme';
import { useHome } from './useHome';
import BluetoothModal from './BluetoothModal';
import WifiModal from './WifiModal';

const sinceLabel = (t: number | null, now: number) => {
  if (!t) return 'Active';
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'Just turned on';
  if (m < 60) return `On for ${m}m`;
  return `On for ${Math.floor(m / 60)}h ${m % 60}m`;
};

function Tile({ channel, index }: { channel: (typeof CHANNELS)[number]; index: number }) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const reduce = useReducedMotion();
  const id = channel.id;
  const on = !!h.on[id];
  const pending = !!h.pending[id];
  const enabled = h.ready;
  const end = h.timerEnd[id];
  const left = end ? Math.max(0, Math.round((end - h.now) / 1000)) : 0;
  const detail = left > 0 ? `Turns off in ${mmss(left)}` : sinceLabel(h.since[id] ?? null, h.now);

  const accentColor = isDark ? channel.color : channel.colorLight;
  const cardBgOn = isDark ? channel.darkBgOn : channel.lightBgOn;
  const cardBorderOn = isDark ? channel.darkBorderOn : channel.lightBorderOn;

  const p = useSharedValue(on ? 1 : 0);
  const burst = useSharedValue(1);
  const breathe = useSharedValue(0);
  const en = useSharedValue(enabled ? 1 : 0);
  const first = useRef(true);

  useEffect(() => {
    p.value = reduce ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 250, easing: Easing.out(Easing.cubic) });
    if (first.current) {
      first.current = false;
      return;
    }
    if (!reduce) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
    }
  }, [on, reduce]);

  useEffect(() => {
    if (reduce) return;
    if (on) {
      breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      breathe.value = withTiming(0, { duration: 400 });
    }
  }, [on, reduce]);

  useEffect(() => {
    en.value = withTiming(enabled ? 1 : 0, { duration: 300 });
  }, [enabled]);

  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.card, cardBgOn]),
    borderColor: interpolateColor(p.value, [0, 1], [colors.line, cardBorderOn]),
    opacity: 0.45 + 0.55 * en.value,
    transform: [{ scale: 1 + 0.012 * breathe.value }],
  }));

  const glow = useAnimatedStyle(() => ({
    opacity: p.value * (0.55 + 0.25 * breathe.value),
    transform: [{ scale: 0.85 + 0.25 * p.value + 0.08 * breathe.value }],
  }));

  const ring = useAnimatedStyle(() => ({
    opacity: 0.65 * (1 - burst.value),
    transform: [{ scale: 0.7 + 2.4 * burst.value }],
  }));

  const iconOff = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const iconOn = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.8 + 0.2 * p.value + 0.06 * breathe.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(260).easing(Easing.out(Easing.cubic))}>
      <Press
        disabled={!enabled}
        onPress={() => {
          tap();
          h.toggle(id);
        }}
      >
        <Animated.View style={[s.tile, card]}>
          {/* Ambient Glow */}
          <Animated.View pointerEvents="none" style={[s.tileGlow, glow]}>
            <Glow id={`tile-glow-${id}`} size={300} color={channel.glow} opacity={isDark ? 0.5 : 0.28} />
          </Animated.View>

          {/* Top Row: Icon Badge + Live Wattage + Toggle */}
          <View style={s.tileTop}>
            <View
              style={[
                s.iconBox,
                {
                  backgroundColor: on ? `${accentColor}25` : colors.surface,
                  borderColor: on ? `${accentColor}60` : colors.line,
                },
              ]}
            >
              <Animated.View style={[s.burstRing, { borderColor: accentColor }, ring]} />
              <Animated.View style={[s.iconLayer, iconOff]}>
                <Ionicons name={channel.icon === 'bulb' ? 'bulb-outline' : 'flash-outline'} size={28} color={colors.dim} />
              </Animated.View>
              <Animated.View style={[s.iconLayer, iconOn]}>
                <Ionicons name={channel.icon as any} size={28} color={accentColor} />
              </Animated.View>
            </View>

            {/* Live Status Pill & Toggle */}
            <View style={s.topRight}>
              {on && (
                <View style={[s.liveBadge, { backgroundColor: `${accentColor}1C`, borderColor: `${accentColor}40` }]}>
                  <Ionicons name="pulse" size={12} color={accentColor} />
                  <Text style={[s.liveBadgeText, { color: accentColor }]}>LIVE</Text>
                </View>
              )}
              <Toggle value={on} pending={pending} colors={colors} activeColor={accentColor} />
            </View>
          </View>

          {/* Bottom Row: Info */}
          <View>
            <View style={s.roomRow}>
              <View style={[s.roomDot, { backgroundColor: on ? accentColor : colors.dim }]} />
              <Text style={[s.roomText, { color: on ? accentColor : colors.dim }]}>{channel.room}</Text>
            </View>
            <Text style={[s.tileName, { color: colors.text }]}>{h.names[id]}</Text>
            <View style={s.statusRow}>
              <Ionicons
                name={pending ? 'sync-outline' : on ? 'checkmark-circle' : 'power-outline'}
                size={14}
                color={on ? accentColor : colors.dim}
              />
              <Text
                style={[
                  s.tileSub,
                  { color: on ? accentColor : colors.dim },
                  on && { fontWeight: '600' },
                ]}
              >
                {pending ? 'Switching…' : on ? detail : 'Turned Off'}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Press>
    </Animated.View>
  );
}

function ConnectButton({
  ready,
  isDark,
  onPress,
}: {
  ready: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (ready) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [ready]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ready ? 0.65 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 2.2 }],
  }));

  return (
    <Press onPress={onPress}>
      <View
        style={[
          s.connectBtn,
          ready
            ? {
                backgroundColor: isDark ? 'rgba(6, 214, 160, 0.12)' : '#ECFDF5',
                borderColor: isDark ? 'rgba(6, 214, 160, 0.4)' : '#A7F3D0',
              }
            : {
                backgroundColor: isDark ? '#141C2E' : '#F1F5F9',
                borderColor: isDark ? '#1F2C46' : '#E2E8F0',
              },
        ]}
      >
        {ready ? (
          <View style={s.dotWrap}>
            <Animated.View style={[s.dotRing, ringStyle]} />
            <View style={s.dotCore} />
          </View>
        ) : (
          <Ionicons name="bluetooth" size={14} color="#0084FF" />
        )}
        <Text
          style={[
            s.connectBtnText,
            {
              color: ready ? '#06D6A0' : isDark ? '#E2E8F0' : '#1E293B',
              fontWeight: '600',
            },
          ]}
        >
          {ready ? 'Connected' : 'Connect'}
        </Text>
        {!ready && (
          <Ionicons
            name="chevron-forward"
            size={13}
            color={isDark ? '#64748B' : '#94A3B8'}
          />
        )}
      </View>
    </Press>
  );
}

function WifiButton({
  wifiStatus,
  wifiSsid,
  bleActive,
  isDark,
  onPress,
}: {
  wifiStatus: string;
  wifiSsid: string | null;
  bleActive: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const isConnected = wifiStatus === 'connected';
  const isConnecting = wifiStatus === 'connecting';

  return (
    <Press onPress={onPress}>
      <View
        style={[
          s.wifiHeaderBtn,
          isConnected
            ? {
                backgroundColor: isDark ? 'rgba(6, 214, 160, 0.12)' : '#ECFDF5',
                borderColor: isDark ? 'rgba(6, 214, 160, 0.4)' : '#A7F3D0',
              }
            : isConnecting
            ? {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A',
              }
            : bleActive
            ? {
                backgroundColor: isDark ? 'rgba(0, 132, 255, 0.12)' : '#EFF6FF',
                borderColor: isDark ? 'rgba(0, 132, 255, 0.35)' : '#BFDBFE',
              }
            : {
                backgroundColor: isDark ? '#141C2E' : '#F1F5F9',
                borderColor: isDark ? '#1F2C46' : '#E2E8F0',
              },
        ]}
      >
        <Ionicons
          name={isConnected ? 'wifi' : 'wifi-outline'}
          size={14}
          color={
            isConnected
              ? '#06D6A0'
              : isConnecting
              ? '#F59E0B'
              : bleActive
              ? '#0084FF'
              : isDark
              ? '#64748B'
              : '#94A3B8'
          }
        />
        <Text
          style={[
            s.wifiHeaderBtnText,
            {
              color: isConnected
                ? '#06D6A0'
                : isConnecting
                ? '#F59E0B'
                : bleActive
                ? '#0084FF'
                : isDark
                ? '#94A3B8'
                : '#64748B',
              fontWeight: isConnected || bleActive ? '600' : '500',
            },
          ]}
          numberOfLines={1}
        >
          {isConnected
            ? wifiSsid || 'Wi-Fi'
            : isConnecting
            ? 'Connecting…'
            : bleActive
            ? 'Wi-Fi Setup'
            : 'Wi-Fi'}
        </Text>
      </View>
    </Press>
  );
}

export default function Home() {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const onCount = CHANNELS.filter((ch) => h.on[ch.id]).length;
  const hour = new Date(h.now).getHours();

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetingIcon = hour < 12 ? 'sunny' : hour < 17 ? 'partly-sunny' : 'moon';
  const greetingColor = hour < 12 ? '#FF9500' : hour < 17 ? '#F59E0B' : '#8B5CF6';

  const allOnActive = onCount === CHANNELS.length && CHANNELS.length > 0;
  const [bleModalOpen, setBleModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
      {/* Top Header Bar with Exact Matching Typography from Timers & Settings */}
      <Animated.View entering={FadeInDown.duration(450)} style={s.top}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Home</Text>
          <View style={s.greetingRow}>
            <Ionicons name={greetingIcon as any} size={15} color={greetingColor} />
            <Text style={[s.greeting, { color: colors.dim }]}>{greeting}</Text>
          </View>
        </View>
        <View style={s.topActions}>
          <WifiButton
            wifiStatus={h.wifiStatus}
            wifiSsid={h.wifiSsid}
            bleActive={h.bleActive}
            isDark={isDark}
            onPress={() => {
              tap();
              setWifiModalOpen(true);
            }}
          />
          <ConnectButton
            ready={h.ready}
            isDark={isDark}
            onPress={() => {
              tap();
              setBleModalOpen(true);
            }}
          />
        </View>
      </Animated.View>

      {/* Hero Glow Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={s.heroCardWrapper}>
        <View
          style={[
            s.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: onCount > 0 ? (isDark ? '#7C4B18' : '#FED7AA') : colors.line,
              shadowColor: colors.lamp,
              shadowOpacity: onCount > 0 ? (isDark ? 0.22 : 0.12) : 0.05,
              shadowRadius: 16,
              elevation: 4,
            },
          ]}
        >
          {/* Ambient Corner Glow */}
          {onCount > 0 && (
            <View pointerEvents="none" style={s.heroGlow}>
              <Glow id="hero-glow" size={320} color={colors.lamp} opacity={isDark ? 0.38 : 0.2} />
            </View>
          )}

          <Ring size={108} stroke={9} progress={onCount / CHANNELS.length} color={onCount > 0 ? colors.lamp : colors.dim}>
            <Animated.Text
              key={onCount}
              entering={ZoomIn.duration(200).easing(Easing.out(Easing.cubic))}
              style={[s.heroNum, { color: colors.text }]}
            >
              {onCount}
              <Text style={{ fontSize: 16, color: colors.dim }}>/{CHANNELS.length}</Text>
            </Animated.Text>
          </Ring>

          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { color: colors.text }]}>
              {onCount === 0 ? 'All Devices Off' : onCount === CHANNELS.length ? 'Full Illumination' : `${onCount} Active Device${onCount > 1 ? 's' : ''}`}
            </Text>
            <Text style={[s.heroSub, { color: colors.dim }]}>
              {!h.ready ? 'Connecting to your switches...' : onCount === 0 ? 'Tap below to activate' : 'System running smoothly'}
            </Text>

            {/* Quick Action Buttons */}
            <View style={s.heroBtnRow}>
              <Press
                disabled={!h.ready}
                onPress={() => {
                  tap();
                  h.allSet(true);
                }}
                style={[
                  s.quickBtn,
                  {
                    backgroundColor: allOnActive ? colors.lamp : `${colors.lamp}20`,
                    borderColor: colors.lamp,
                  },
                ]}
              >
                <Ionicons name="sunny" size={14} color={allOnActive ? '#FFFFFF' : colors.lamp} />
                <Text
                  style={[
                    s.quickBtnText,
                    { color: allOnActive ? '#FFFFFF' : colors.lamp, fontWeight: '700' },
                  ]}
                >
                  All On
                </Text>
              </Press>

              <Press
                disabled={!h.ready}
                onPress={() => {
                  tap();
                  h.allSet(false);
                }}
                style={[
                  s.quickBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                <Ionicons name="power" size={14} color={colors.dim} />
                <Text style={[s.quickBtnText, { color: colors.dim, fontWeight: '600' }]}>All Off</Text>
              </Press>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Smart Scenes Quick Bar */}
      <Animated.View entering={FadeInDown.delay(180).duration(450)} style={s.scenesContainer}>
        <Text style={[s.sectionTitle, { color: colors.dim }]}>QUICK SCENES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scenesRow}>
          <Press
            disabled={!h.ready}
            onPress={() => {
              tap();
              h.allSet(false);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="moon-outline" size={15} color="#8B5CF6" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>Cinema Mode</Text>
          </Press>

          <Press
            disabled={!h.ready}
            onPress={() => {
              tap();
              if (!h.on[1]) h.toggle(1);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="sunny-outline" size={15} color="#FF9500" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>Living Glow</Text>
          </Press>

          <Press
            disabled={!h.ready}
            onPress={() => {
              tap();
              if (!h.on[2]) h.toggle(2);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="bed-outline" size={15} color="#06D6A0" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>Night Comfort</Text>
          </Press>
        </ScrollView>
      </Animated.View>

      {/* Section Header */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.dim }]}>CONTROLS</Text>
        <View style={s.channelCountWrap}>
          <Ionicons name="hardware-chip-outline" size={13} color={colors.dim} />
          <Text style={[s.sectionCount, { color: colors.dim }]}>{CHANNELS.length} switches</Text>
        </View>
      </View>

      {/* Colorful Switch Tiles */}
      <View style={s.tiles}>
        {CHANNELS.map((ch, i) => (
          <Tile key={ch.id} channel={ch} index={i} />
        ))}
      </View>

      {/* Bluetooth Discovery & Pairing Modal */}
      <BluetoothModal
        visible={bleModalOpen}
        onClose={() => setBleModalOpen(false)}
        onOpenWifi={() => setWifiModalOpen(true)}
      />

      {/* Device Wi-Fi Provisioning Modal */}
      <WifiModal
        visible={wifiModalOpen}
        onClose={() => setWifiModalOpen(false)}
        onOpenBluetooth={() => setBleModalOpen(true)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  connectBtnText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  wifiHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
    maxWidth: 130,
  },
  wifiHeaderBtnText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#06D6A0',
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06D6A0',
  },
  headerTitle: {
    fontSize: 42,
    fontWeight: '300',
    letterSpacing: -1.3,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  greeting: { fontSize: 15, fontWeight: '400' },
  heroCardWrapper: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 28,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    left: -70,
    top: -70,
  },
  heroNum: { fontSize: 30, fontWeight: '700' },
  heroTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  heroSub: { fontSize: 13, marginTop: 2 },
  heroBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 13 },
  scenesContainer: {
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  scenesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sceneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  sceneChipText: { fontSize: 13, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  channelCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  tiles: { paddingHorizontal: 20, gap: 14 },
  tile: {
    height: 184,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  tileGlow: { position: 'absolute', left: -70, top: -70 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  burstRing: { position: 'absolute', width: 56, height: 56, borderRadius: 20, borderWidth: 2 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  roomDot: { width: 6, height: 6, borderRadius: 3 },
  roomText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  tileName: { fontSize: 23, fontWeight: '700', letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  tileSub: { fontSize: 14 },
});
