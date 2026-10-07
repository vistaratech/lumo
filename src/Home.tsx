import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CHANNELS } from './config';
import { Press, Toggle, mmss, tap } from './theme';
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

/* ---------- Minimal & Clean Switch Card ---------- */
function SwitchCard({ channel, index }: { channel: (typeof CHANNELS)[number]; index: number }) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const reduce = useReducedMotion();
  const id = channel.id;
  const on = !!h.on[id];
  const pending = !!h.pending[id];
  const end = h.timerEnd[id];
  const left = end ? Math.max(0, Math.round((end - h.now) / 1000)) : 0;
  const timerActive = left > 0;
  const detail = timerActive ? `Auto-off in ${mmss(left)}` : sinceLabel(h.since[id] ?? null, h.now);

  const accentColor = isDark ? channel.color : channel.colorLight;

  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = reduce ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [on, reduce]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      p.value,
      [0, 1],
      [colors.card, isDark ? channel.darkBgOn : channel.lightBgOn]
    ),
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      [colors.line, isDark ? channel.darkBorderOn : channel.lightBorderOn]
    ),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 50).duration(240).easing(Easing.out(Easing.cubic))}>
      <Press
        onPress={() => {
          tap();
          h.toggle(id);
        }}
      >
        <Animated.View style={[s.switchCard, cardStyle]}>
          {/* Left Icon Badge */}
          <View
            style={[
              s.iconBox,
              {
                backgroundColor: on ? `${accentColor}22` : colors.surface,
                borderColor: on ? `${accentColor}45` : colors.line,
              },
            ]}
          >
            <Ionicons
              name={channel.icon as any}
              size={24}
              color={on ? accentColor : colors.dim}
            />
          </View>

          {/* Middle Info */}
          <View style={s.cardInfo}>
            <View style={s.roomTagRow}>
              <Text style={[s.roomText, { color: on ? accentColor : colors.dim }]}>
                {channel.room.toUpperCase()}
              </Text>
              {timerActive && (
                <View style={[s.timerPill, { backgroundColor: `${accentColor}20` }]}>
                  <Ionicons name="timer" size={11} color={accentColor} />
                  <Text style={[s.timerPillText, { color: accentColor }]}>{mmss(left)}</Text>
                </View>
              )}
            </View>

            <Text style={[s.nameText, { color: colors.text }]}>{h.names[id]}</Text>

            <Text style={[s.statusText, { color: on ? (timerActive ? accentColor : colors.dim) : colors.dimmer }]}>
              {pending ? 'Switching…' : on ? detail : 'Turned off'}
            </Text>
          </View>

          {/* Right Toggle */}
          <Toggle value={on} pending={pending} colors={colors} activeColor={accentColor} />
        </Animated.View>
      </Press>
    </Animated.View>
  );
}

/* ---------- Minimal Connect Pill ---------- */
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
    transform: [{ scale: 1 + pulse.value * 2 }],
  }));

  return (
    <Press onPress={onPress}>
      <View
        style={[
          s.headerBtn,
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
          <Ionicons name="bluetooth" size={13} color="#0084FF" />
        )}
        <Text
          style={[
            s.headerBtnText,
            { color: ready ? '#06D6A0' : isDark ? '#E2E8F0' : '#1E293B', fontWeight: '600' },
          ]}
        >
          {ready ? 'Connected' : 'Connect'}
        </Text>
      </View>
    </Press>
  );
}

/* ---------- Minimal Wi-Fi Pill ---------- */
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

  return (
    <Press onPress={onPress}>
      <View
        style={[
          s.headerBtn,
          isConnected
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
        <Ionicons
          name={isConnected ? 'wifi' : 'wifi-outline'}
          size={13}
          color={isConnected ? '#06D6A0' : isDark ? '#64748B' : '#94A3B8'}
        />
        <Text
          style={[
            s.headerBtnText,
            { color: isConnected ? '#06D6A0' : isDark ? '#94A3B8' : '#64748B', fontWeight: '500' },
          ]}
          numberOfLines={1}
        >
          {isConnected ? wifiSsid || 'Wi-Fi' : 'Wi-Fi'}
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

  const [bleModalOpen, setBleModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      {/* Clean Top Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.topBar}>
        <View>
          <View style={s.greetingRow}>
            <Ionicons name={greetingIcon as any} size={14} color={greetingColor} />
            <Text style={[s.greetingText, { color: colors.dim }]}>{greeting}</Text>
          </View>
          <Text style={[s.pageTitle, { color: colors.text }]}>Home</Text>
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

      {/* Clean & Compact Status Card */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)} style={s.summaryCardWrap}>
        <View
          style={[
            s.summaryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
            },
          ]}
        >
          <View style={s.summaryInfo}>
            <View style={s.statusDotRow}>
              <View
                style={[
                  s.statusLiveDot,
                  { backgroundColor: onCount > 0 ? colors.ok : colors.dimmer },
                ]}
              />
              <Text style={[s.summaryHeadline, { color: colors.text }]}>
                {onCount === 0
                  ? 'All devices off'
                  : onCount === CHANNELS.length
                  ? 'All switches active'
                  : `${onCount} of ${CHANNELS.length} switches on`}
              </Text>
            </View>
            <Text style={[s.summarySub, { color: colors.dim }]}>
              {h.ready ? 'Connected & ready' : 'Connecting to switches...'}
            </Text>
          </View>

          {/* Quick All On / All Off Pills */}
          <View style={s.quickActionRow}>
            <Press
              onPress={() => {
                tap();
                h.allSet(true);
              }}
              style={[
                s.quickPill,
                {
                  backgroundColor: onCount === CHANNELS.length ? `${colors.lamp}20` : colors.surface,
                  borderColor: onCount === CHANNELS.length ? colors.lamp : colors.line,
                },
              ]}
            >
              <Ionicons
                name="sunny"
                size={13}
                color={onCount === CHANNELS.length ? colors.lamp : colors.dim}
              />
              <Text
                style={[
                  s.quickPillText,
                  {
                    color: onCount === CHANNELS.length ? colors.lamp : colors.text,
                    fontWeight: '600',
                  },
                ]}
              >
                All On
              </Text>
            </Press>

            <Press
              onPress={() => {
                tap();
                h.allSet(false);
              }}
              style={[s.quickPill, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              <Ionicons name="power" size={13} color={colors.dim} />
              <Text style={[s.quickPillText, { color: colors.dim, fontWeight: '600' }]}>All Off</Text>
            </Press>
          </View>
        </View>
      </Animated.View>

      {/* Clean Quick Scenes */}
      <Animated.View entering={FadeInDown.delay(120).duration(350)} style={s.scenesContainer}>
        <Text style={[s.sectionTitle, { color: colors.dim }]}>QUICK SCENES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scenesRow}>
          <Press
            onPress={() => {
              tap();
              h.allSet(false);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="power" size={14} color="#F43F5E" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>All Off</Text>
          </Press>

          <Press
            onPress={() => {
              tap();
              h.allSet(true);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="sunny" size={14} color="#FF9500" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>Full Light</Text>
          </Press>

          <Press
            onPress={() => {
              tap();
              h.send(1, false);
              h.startTimer(2, 30);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="bed-outline" size={14} color="#06D6A0" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>Night (30m)</Text>
          </Press>

          <Press
            onPress={() => {
              tap();
              h.startTimer(1, 45);
            }}
            style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Ionicons name="book-outline" size={14} color="#8B5CF6" />
            <Text style={[s.sceneChipText, { color: colors.text }]}>Focus (45m)</Text>
          </Press>
        </ScrollView>
      </Animated.View>

      {/* Section Header */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.dim }]}>CONTROLS</Text>
        <Text style={[s.switchCountText, { color: colors.dim }]}>{CHANNELS.length} switches</Text>
      </View>

      {/* Clean Switch Cards List */}
      <View style={s.switchList}>
        {CHANNELS.map((ch, i) => (
          <SwitchCard key={ch.id} channel={ch} index={i} />
        ))}
      </View>

      {/* Bluetooth Discovery Modal */}
      <BluetoothModal
        visible={bleModalOpen}
        onClose={() => setBleModalOpen(false)}
        onOpenWifi={() => setWifiModalOpen(true)}
      />

      {/* Wi-Fi Provisioning Modal */}
      <WifiModal
        visible={wifiModalOpen}
        onClose={() => setWifiModalOpen(false)}
        onOpenBluetooth={() => setBleModalOpen(true)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerBtnText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  dotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06D6A0',
  },
  dotCore: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#06D6A0',
  },

  /* Summary Card */
  summaryCardWrap: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  summaryInfo: { gap: 3 },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  summaryHeadline: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  summarySub: {
    fontSize: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickPillText: {
    fontSize: 12,
  },

  /* Scenes */
  scenesContainer: {
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scenesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sceneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  sceneChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Controls Section */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  switchCountText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Switch Cards */
  switchList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  roomTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  timerPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
