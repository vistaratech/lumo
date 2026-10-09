import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ChannelConfig } from './config';
import { Glow, Press, Ring, Toggle, mmss, tap } from './theme';
import { useHome } from './useHome';
import BluetoothModal from './BluetoothModal';
import WifiModal from './WifiModal';
import VoiceModal from './VoiceModal';
import AddSceneModal from './AddSceneModal';
import EditSwitchModal from './EditSwitchModal';
import DeviceConnectModal from './DeviceConnectModal';

const sinceLabel = (t: number | null, now: number) => {
  if (!t) return 'Active';
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'Just turned on';
  if (m < 60) return `On for ${m}m`;
  return `On for ${Math.floor(m / 60)}h ${m % 60}m`;
};

function Tile({
  channel,
  index,
  onEdit,
}: {
  channel: ChannelConfig;
  index: number;
  onEdit?: (id: number) => void;
}) {
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

  const accentColor = isDark ? channel.color : channel.colorLight;
  const cardBgOn = isDark ? channel.darkBgOn : channel.lightBgOn;
  const cardBorderOn = isDark ? channel.darkBorderOn : channel.lightBorderOn;

  const p = useSharedValue(on ? 1 : 0);
  const burst = useSharedValue(1);
  const breathe = useSharedValue(0);
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

  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.card, cardBgOn]),
    borderColor: interpolateColor(p.value, [0, 1], [colors.line, cardBorderOn]),
    opacity: 1, // Keep fully interactive and bright at all times
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
        onPress={() => {
          tap();
          h.toggle(id);
        }}
        onLongPress={() => {
          tap();
          onEdit?.(id);
        }}
        delayLongPress={420}
      >
        <Animated.View style={[s.tile, card]}>
          {/* Ambient Glow */}
          <Animated.View pointerEvents="none" style={[s.tileGlow, glow]}>
            <Glow id={`tile-glow-${id}`} size={300} color={channel.glow} opacity={isDark ? 0.5 : 0.28} />
          </Animated.View>

          {/* Top Row: Icon Badge + Badges + Toggle */}
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

            {/* Badges & Live Toggle */}
            <View style={s.topRight}>
              {/* Active Timer Pill */}
              {timerActive && (
                <View style={[s.timerBadge, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }]}>
                  <Ionicons name="timer" size={12} color={accentColor} />
                  <Text style={[s.timerBadgeText, { color: accentColor }]}>{mmss(left)}</Text>
                </View>
              )}

              {on && !timerActive && (
                <View style={[s.liveBadge, { backgroundColor: `${accentColor}1C`, borderColor: `${accentColor}40` }]}>
                  <Ionicons name="pulse" size={12} color={accentColor} />
                  <Text style={[s.liveBadgeText, { color: accentColor }]}>LIVE</Text>
                </View>
              )}

              <Toggle value={on} pending={pending} colors={colors} activeColor={accentColor} />
            </View>
          </View>

          {/* Bottom Row: Room & Channel Nickname */}
          <View>
            <Pressable
              onPress={() => {
                tap();
                onEdit?.(id);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={s.roomRow}
            >
              <View style={[s.roomDot, { backgroundColor: on ? accentColor : colors.dim }]} />
              <Text style={[s.roomText, { color: on ? accentColor : colors.dim }]}>
                {h.rooms[id] || channel.room}
              </Text>
              <Ionicons
                name="pencil-sharp"
                size={9}
                color={on ? accentColor : colors.dimmer}
                style={{ opacity: 0.75, marginLeft: 2 }}
              />
            </Pressable>
            <Text style={[s.tileName, { color: colors.text }]}>{h.names[id]}</Text>
            <View style={s.statusRow}>
              <Ionicons
                name={pending ? 'sync-outline' : timerActive ? 'timer-outline' : on ? 'checkmark-circle' : 'power-outline'}
                size={14}
                color={on ? accentColor : colors.dim}
              />
              <Text
                style={[
                  s.tileSub,
                  { color: on ? accentColor : colors.dim },
                ]}
              >
                {pending ? 'Switching…' : timerActive ? `Off in ${mmss(left)}` : on ? 'On' : 'Off'}
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
  bleActive,
  isDark,
  onPress,
}: {
  ready: boolean;
  bleActive: boolean;
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
    <Press style={{ flex: 1 }} onPress={onPress}>
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
    <Press style={{ flex: 1 }} onPress={onPress}>
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
  const channels = h.channels;
  const onCount = channels.filter((ch) => h.on[ch.id]).length;
  const hour = new Date(h.now).getHours();

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetingIcon = hour < 12 ? 'sunny' : hour < 17 ? 'partly-sunny' : 'moon';
  const greetingColor = hour < 12 ? '#FF9500' : hour < 17 ? '#F59E0B' : '#8B5CF6';

  const allOnActive = onCount === channels.length && channels.length > 0;
  const [bleModalOpen, setBleModalOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [addSceneOpen, setAddSceneOpen] = useState(false);
  const [editSwitchChannelId, setEditSwitchChannelId] = useState<number | null>(null);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
      {/* Top Header Bar */}
      <Animated.View entering={FadeInDown.duration(450)} style={s.top}>
        <View style={s.topHeaderRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[s.headerTitle, { color: colors.text }]}>Home</Text>
            <View style={s.greetingRow}>
              <Ionicons name={greetingIcon as any} size={15} color={greetingColor} />
              <Text style={[s.greeting, { color: colors.dim }]}>
                {h.user && !h.user.isGuest ? `${greeting}, ${h.user.displayName.split(' ')[0]}` : greeting}
              </Text>
            </View>
          </View>

          {/* User Account / Profile Badge on top-right */}
          <Press
            onPress={() => {
              tap();
              h.openAuthModal();
            }}
            style={[
              s.accountTopBadge,
              {
                backgroundColor:
                  h.user && !h.user.isGuest
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.12)'
                      : '#ECFDF5'
                    : isDark
                    ? 'rgba(255, 159, 28, 0.12)'
                    : '#FFF7ED',
                borderColor: h.user && !h.user.isGuest ? '#10B981' : colors.lamp,
              },
            ]}
          >
            <Ionicons
              name={h.user && !h.user.isGuest ? 'shield-checkmark' : 'person-circle-outline'}
              size={15}
              color={h.user && !h.user.isGuest ? '#10B981' : colors.lamp}
            />
            <Text
              style={[
                s.accountTopBadgeText,
                { color: h.user && !h.user.isGuest ? '#10B981' : colors.lamp },
              ]}
              numberOfLines={1}
            >
              {h.user && !h.user.isGuest ? h.user.displayName.split(' ')[0] : 'Account'}
            </Text>
          </Press>
        </View>

        <View style={s.topActionsRow}>
          <Press
            onPress={() => {
              tap();
              setVoiceModalOpen(true);
            }}
            style={[
              s.voiceBtn,
              {
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#E0F2FE',
                borderColor: '#38BDF8',
              },
            ]}
          >
            <Ionicons name="mic" size={14} color="#38BDF8" />
            <Text style={s.voiceBtnText}>Voice</Text>
          </Press>

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
            bleActive={h.bleActive}
            isDark={isDark}
            onPress={() => {
              tap();
              setDeviceModalOpen(true);
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

          <Ring size={108} stroke={9} progress={channels.length > 0 ? onCount / channels.length : 0} color={onCount > 0 ? colors.lamp : colors.dim}>
            <Animated.Text
              key={onCount}
              entering={ZoomIn.duration(200).easing(Easing.out(Easing.cubic))}
              style={[s.heroNum, { color: colors.text }]}
            >
              {onCount}
              <Text style={{ fontSize: 16, color: colors.dim }}>/{channels.length}</Text>
            </Animated.Text>
          </Ring>

          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { color: colors.text }]}>
              {onCount === 0 ? 'All Devices Off' : onCount === channels.length ? 'Full Illumination' : `${onCount} Active Device${onCount > 1 ? 's' : ''}`}
            </Text>
            {!h.ready && (
              <Text style={[s.heroSub, { color: colors.dim }]}>
                Connecting…
              </Text>
            )}

            {/* Quick Action Buttons */}
            <View style={s.heroBtnRow}>
              <Press
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
                    { color: allOnActive ? '#FFFFFF' : colors.lamp },
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
                style={[
                  s.quickBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                <Ionicons name="power" size={14} color={colors.dim} />
                <Text style={[s.quickBtnText, { color: colors.dim }]}>All Off</Text>
              </Press>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Smart Scenes Quick Bar */}
      <Animated.View entering={FadeInDown.delay(180).duration(450)} style={s.scenesContainer}>
        <Text style={[s.sectionTitle, { color: colors.dim }]}>QUICK SCENES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scenesRow}>
          {h.scenes.map((sc) => (
            <Pressable
              key={sc.id}
              onPress={() => {
                tap();
                h.activateScene(sc);
              }}
              onLongPress={() => {
                if (sc.isCustom) {
                  tap();
                  h.removeCustomScene(sc.id);
                }
              }}
              style={[s.sceneChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              <Ionicons name={sc.icon as any} size={15} color={sc.color || colors.lamp} />
              <Text style={[s.sceneChipText, { color: colors.text }]}>{sc.name}</Text>
            </Pressable>
          ))}

          <Press
            onPress={() => {
              tap();
              setAddSceneOpen(true);
            }}
            style={[
              s.sceneChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.lamp,
                borderStyle: 'dashed',
              },
            ]}
          >
            <Ionicons name="add" size={15} color={colors.lamp} />
            <Text style={[s.sceneChipText, { color: colors.lamp }]}>+ Custom</Text>
          </Press>
        </ScrollView>
      </Animated.View>

      {/* Section Header */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.dim }]}>CONTROLS</Text>
        <Press
          onPress={() => {
            tap();
            setDeviceModalOpen(true);
          }}
          style={s.channelCountWrap}
        >
          <Ionicons name="hardware-chip-outline" size={13} color={colors.dim} />
          <Text style={[s.sectionCount, { color: colors.dim }]}>
            {channels.length} switches • {h.selectedModel.name}
          </Text>
          <Ionicons name="swap-horizontal" size={13} color={colors.dim} />
        </Press>
      </View>

      {/* Colorful Switch Tiles */}
      <View style={s.tiles}>
        {channels.map((ch, i) => (
          <Tile
            key={ch.id}
            channel={ch}
            index={i}
            onEdit={(channelId) => setEditSwitchChannelId(channelId)}
          />
        ))}
      </View>

      {/* 4-Step Hardware Device Connect & Test Wizard */}
      <DeviceConnectModal
        visible={deviceModalOpen || h.deviceConnectModalOpen}
        onClose={() => {
          setDeviceModalOpen(false);
          h.closeDeviceConnectModal();
        }}
        onOpenWifi={() => setWifiModalOpen(true)}
      />

      {/* Voice Assistant Modal */}
      <VoiceModal
        visible={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
      />

      {/* Add Custom Scene Modal */}
      <AddSceneModal
        visible={addSceneOpen}
        onClose={() => setAddSceneOpen(false)}
      />

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

      {/* Quick Edit Switch & Room Modal */}
      <EditSwitchModal
        visible={editSwitchChannelId !== null}
        channelId={editSwitchChannelId}
        onClose={() => setEditSwitchChannelId(null)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  accountTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  accountTopBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 90,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  voiceBtn: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
  connectBtn: {
    width: '100%',
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  connectBtnText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  wifiHeaderBtn: {
    width: '100%',
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
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
  heroNum: { fontSize: 32, fontWeight: '300', letterSpacing: -0.8 },
  heroTitle: { fontSize: 20, fontWeight: '300', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, fontWeight: '300', marginTop: 2 },
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
  quickBtnText: { fontSize: 13, fontWeight: '300', letterSpacing: -0.2 },
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
  sceneChipText: { fontSize: 13, fontWeight: '300', letterSpacing: -0.2 },
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
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  timerBadgeText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  roomText: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 },
  tileName: { fontSize: 24, fontWeight: '300', letterSpacing: -0.6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  tileSub: { fontSize: 13, fontWeight: '300', letterSpacing: -0.2 },
});
