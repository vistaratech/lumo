import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ChannelConfig } from './config';
import { Header, Press, StatusPill, ThemeColors, ThemeMode, Toggle, tap } from './theme';
import { useHome } from './useHome';
import BluetoothModal from './BluetoothModal';
import WifiModal from './WifiModal';
import WhatsNewModal from './WhatsNewModal';
import DeviceConnectModal from './DeviceConnectModal';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: any; color: string }[] = [
  { mode: 'dark', label: 'Dark', icon: 'moon', color: '#8B5CF6' },
  { mode: 'light', label: 'Light', icon: 'sunny', color: '#FF9500' },
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline', color: '#06D6A0' },
];

function Section({
  i,
  title,
  icon,
  iconColor,
  children,
  dimColor,
  colors,
}: {
  i: number;
  title: string;
  icon: any;
  iconColor: string;
  children: React.ReactNode;
  dimColor: string;
  colors: ThemeColors;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + i * 50).duration(240).easing(Easing.out(Easing.cubic))} style={s.section}>
      <View style={s.sectionHeaderRow}>
        <View style={[s.sectionIconBadge, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
        <Text style={[s.sectionTitle, { color: dimColor }]}>{title}</Text>
      </View>
      <View style={s.group}>{children}</View>
    </Animated.View>
  );
}

function ThemeSegmentControl({
  themeMode,
  setThemeMode,
  colors,
}: {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  colors: ThemeColors;
}) {
  const { width } = useWindowDimensions();
  const containerW = width - 40;
  const itemW = (containerW - 10) / 3;
  const activeIdx = THEME_OPTIONS.findIndex((t) => t.mode === themeMode);

  const x = useSharedValue(activeIdx * itemW);

  React.useEffect(() => {
    x.value = withTiming(activeIdx * itemW, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [activeIdx, itemW]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const activeColor = THEME_OPTIONS[activeIdx]?.color || colors.lamp;

  return (
    <View
      style={[
        s.segmentContainer,
        {
          width: containerW,
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      {/* Animated active pill */}
      <Animated.View
        style={[
          s.segmentPill,
          {
            width: itemW,
            backgroundColor: colors.card,
            borderColor: activeColor,
            shadowColor: activeColor,
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 6,
            elevation: 3,
          },
          pillStyle,
        ]}
      />

      {THEME_OPTIONS.map((opt) => {
        const active = opt.mode === themeMode;
        return (
          <Press
            key={opt.mode}
            onPress={() => {
              tap();
              setThemeMode(opt.mode);
            }}
            style={[s.segmentBtn, { width: itemW }]}
          >
            <Ionicons
              name={opt.icon}
              size={18}
              color={active ? opt.color : colors.dim}
            />
            <Text
              style={[
                s.segmentText,
                { color: active ? opt.color : colors.dim },
                active && { fontWeight: '700' },
              ]}
            >
              {opt.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

const ROOM_PRESETS = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Hall',
  'Balcony',
  'Outdoor',
  'Dining',
  'Office',
  'Bathroom',
];

function SwitchSetupCard({ channel }: { channel: ChannelConfig }) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const id = channel.id;

  const accentColor = isDark ? channel.color : channel.colorLight;
  const currentRoom = h.rooms[id] || channel.room;

  return (
    <View
      style={[
        s.switchCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.line,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        },
      ]}
    >
      {/* Card Header */}
      <View style={s.switchCardHeader}>
        <View style={s.switchCardHeaderLeft}>
          <View style={[s.fieldIconWrap, { backgroundColor: `${accentColor}18` }]}>
            <Ionicons name={channel.icon as any} size={18} color={accentColor} />
          </View>
          <View>
            <Text style={[s.switchCardTitle, { color: colors.text }]}>Switch {id}</Text>
            <Text style={[s.switchCardSub, { color: colors.dim }]}>Relay Channel {id}</Text>
          </View>
        </View>

        <View style={[s.roomBadge, { backgroundColor: `${accentColor}16`, borderColor: `${accentColor}40` }]}>
          <Ionicons name="home" size={11} color={accentColor} />
          <Text style={[s.roomBadgeText, { color: accentColor }]}>{currentRoom}</Text>
        </View>
      </View>

      {/* Switch Name Field */}
      <View style={s.inputBlock}>
        <Text style={[s.inputLabel, { color: colors.dim }]}>SWITCH NAME</Text>
        <View style={[s.inputFieldRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Ionicons name="pricetag-outline" size={16} color={accentColor} />
          <TextInput
            value={h.names[id]}
            onChangeText={(t) => h.setName(id, t)}
            maxLength={20}
            selectionColor={accentColor}
            placeholder={`Switch ${id}`}
            placeholderTextColor={colors.dimmer}
            style={[s.cleanInput, { color: colors.text }]}
          />
        </View>
      </View>

      {/* Assigned Room Field */}
      <View style={s.inputBlock}>
        <Text style={[s.inputLabel, { color: colors.dim }]}>ASSIGNED ROOM</Text>
        <View style={[s.inputFieldRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Ionicons name="business-outline" size={16} color={accentColor} />
          <TextInput
            value={h.rooms[id] || channel.room}
            onChangeText={(t) => h.setRoom(id, t)}
            maxLength={20}
            selectionColor={accentColor}
            placeholder="e.g. Living Room, Bedroom"
            placeholderTextColor={colors.dimmer}
            style={[s.cleanInput, { color: colors.text }]}
          />
        </View>

        {/* Quick Room Preset Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={s.chipsScroll}
        >
          {ROOM_PRESETS.map((preset) => {
            const isSelected = currentRoom.trim().toLowerCase() === preset.toLowerCase();
            return (
              <Press
                key={preset}
                onPress={() => {
                  tap();
                  h.setRoom(id, preset);
                }}
                style={[
                  s.roomChip,
                  {
                    backgroundColor: isSelected ? `${accentColor}25` : colors.card,
                    borderColor: isSelected ? accentColor : colors.line,
                  },
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark-sharp" size={11} color={accentColor} style={{ marginRight: 3 }} />
                )}
                <Text
                  style={[
                    s.roomChipText,
                    {
                      color: isSelected ? accentColor : colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {preset}
                </Text>
              </Press>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function StatusRow({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  cardBg,
  lineColor,
  textColor,
  dimColor,
}: {
  icon: any;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  cardBg: string;
  lineColor: string;
  textColor: string;
  dimColor: string;
}) {
  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: cardBg,
          borderColor: lineColor,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        },
      ]}
    >
      <View style={s.rowLeft}>
        <View style={[s.rowIconBox, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[s.rowLabel, { color: textColor }]}>{label}</Text>
      </View>
      <Text
        style={[
          s.rowValue,
          { color: valueColor || dimColor },
          valueColor ? { fontWeight: '600' } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function AccountCard() {
  const h = useHome();
  const colors = h.colors;
  const user = h.user;
  const isGuest = !user || user.isGuest;

  return (
    <View
      style={[
        s.accountCard,
        {
          backgroundColor: colors.card,
          borderColor: isGuest ? colors.line : `${colors.lamp}40`,
        },
      ]}
    >
      <View style={s.accountTop}>
        <View
          style={[
            s.accountAvatar,
            {
              backgroundColor: isGuest ? colors.surface : `${colors.lamp}20`,
              borderColor: isGuest ? colors.line : colors.lamp,
            },
          ]}
        >
          <Ionicons
            name={isGuest ? 'person-outline' : 'shield-checkmark'}
            size={22}
            color={isGuest ? colors.dim : colors.lamp}
          />
        </View>
        <View style={s.accountInfo}>
          <View style={s.accountBadgeRow}>
            <Text style={[s.accountName, { color: colors.text }]}>
              {user?.displayName || 'Guest Household'}
            </Text>
            <View
              style={[
                s.roleTag,
                {
                  backgroundColor: isGuest ? `${colors.dim}18` : `${colors.ok}18`,
                  borderColor: isGuest ? colors.dimmer : colors.ok,
                },
              ]}
            >
              <Text
                style={[
                  s.roleTagText,
                  { color: isGuest ? colors.dim : colors.ok },
                ]}
              >
                {isGuest ? 'OFFLINE GUEST' : 'OWNER • SECURE'}
              </Text>
            </View>
          </View>
          <Text style={[s.accountSub, { color: colors.dim }]}>
            {user?.householdName || 'My Home'} • {user?.email || 'Offline'}
          </Text>
        </View>
      </View>

      <View style={[s.accountDivider, { backgroundColor: colors.line }]} />

      <View style={s.accountActions}>
        {isGuest ? (
          <Press
            style={[s.accountBtnPrimary, { backgroundColor: colors.lamp }]}
            onPress={() => {
              tap();
              h.openAuthModal();
            }}
          >
            <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            <Text style={s.accountBtnPrimaryText}>Sign In / Sync</Text>
          </Press>
        ) : (
          <View style={s.accountBtnRow}>
            <Press
              style={[s.accountBtnSecondary, { backgroundColor: colors.surface, borderColor: colors.line }]}
              onPress={() => {
                tap();
                h.openAuthModal();
              }}
            >
              <Ionicons name="swap-horizontal" size={14} color={colors.text} />
              <Text style={[s.accountBtnSecondaryText, { color: colors.text }]}>Switch Account</Text>
            </Press>

            <Press
              style={[s.accountBtnSecondary, { backgroundColor: `${colors.bad}14`, borderColor: `${colors.bad}30` }]}
              onPress={() => {
                tap();
                h.signOutUser();
              }}
            >
              <Ionicons name="log-out-outline" size={14} color={colors.bad} />
              <Text style={[s.accountBtnSecondaryText, { color: colors.bad }]}>Sign Out</Text>
            </Press>
          </View>
        )}
      </View>
    </View>
  );
}

export default function Settings() {
  const h = useHome();
  const colors = h.colors;
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [bleModalOpen, setBleModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [whatsNewModalOpen, setWhatsNewModalOpen] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 150 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Header title="Settings" colors={colors} />

      {/* Household & Account Card */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <AccountCard />
      </View>

      {/* Hardware Controller Model & Pairing */}
      <Section
        i={0}
        title="HARDWARE CONTROLLER"
        icon="hardware-chip-outline"
        iconColor={h.selectedModel.badgeColor}
        dimColor={colors.dim}
        colors={colors}
      >
        <Press
          onPress={() => {
            tap();
            setDeviceModalOpen(true);
          }}
          style={[
            s.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={s.rowLeft}>
            <View style={[s.rowIconBox, { backgroundColor: `${h.selectedModel.badgeColor}20` }]}>
              <Ionicons name="hardware-chip" size={16} color={h.selectedModel.badgeColor} />
            </View>
            <View>
              <Text style={[s.rowLabel, { color: colors.text }]}>{h.selectedModel.name}</Text>
              <Text style={{ fontSize: 11.5, color: colors.dim }}>
                {h.selectedModel.channels} Channels • {h.selectedModel.tag}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12.5, color: '#38BDF8', fontWeight: '600' }}>Setup / Change</Text>
            <Ionicons name="chevron-forward" size={15} color="#38BDF8" />
          </View>
        </Press>
      </Section>

      {/* Appearance Segment Control */}
      <Section
        i={1}
        title="APPEARANCE"
        icon="color-palette"
        iconColor="#8B5CF6"
        dimColor={colors.dim}
        colors={colors}
      >
        <ThemeSegmentControl
          themeMode={h.themeMode}
          setThemeMode={h.setThemeMode}
          colors={colors}
        />
      </Section>

      {/* Switch & Room Setup Section */}
      <Section
        i={2}
        title="SWITCH & ROOM SETUP"
        icon="layers-outline"
        iconColor="#FF9500"
        dimColor={colors.dim}
        colors={colors}
      >
        {h.channels.map((ch) => (
          <SwitchSetupCard key={ch.id} channel={ch} />
        ))}
      </Section>

      {/* Feel / Haptics Section */}
      <Section
        i={2}
        title="FEEDBACK"
        icon="phone-portrait"
        iconColor="#EC4899"
        dimColor={colors.dim}
        colors={colors}
      >
        <Press
          style={[
            s.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 6,
              elevation: 2,
            },
          ]}
          onPress={() => {
            h.setHaptics(!h.haptics);
            if (!h.haptics) tap();
          }}
        >
          <View style={s.rowLeft}>
            <View style={[s.rowIconBox, { backgroundColor: '#EC489918' }]}>
              <Ionicons name="finger-print-outline" size={16} color="#EC4899" />
            </View>
            <Text style={[s.rowLabel, { color: colors.text }]}>Vibration Feedback</Text>
          </View>
          <Toggle value={h.haptics} colors={colors} activeColor="#EC4899" />
        </Press>
      </Section>

      {/* Safety & Night Guard Section */}
      <Section
        i={3}
        title="SAFETY & NIGHT GUARD"
        icon="shield-outline"
        iconColor="#38BDF8"
        dimColor={colors.dim}
        colors={colors}
      >
        <Press
          style={[
            s.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 6,
              elevation: 2,
            },
          ]}
          onPress={() => {
            tap();
            h.setNightGuard({
              enabled: !h.nightGuard.enabled,
              maxHours: h.nightGuard.maxHours,
            });
          }}
        >
          <View style={s.rowLeft}>
            <View style={[s.rowIconBox, { backgroundColor: '#38BDF818' }]}>
              <Ionicons name="moon-outline" size={16} color="#38BDF8" />
            </View>
            <View>
              <Text style={[s.rowLabel, { color: colors.text }]}>Auto-Off Protection</Text>
            </View>
          </View>
          <Toggle value={h.nightGuard.enabled} colors={colors} activeColor="#38BDF8" />
        </Press>

        {h.nightGuard.enabled && (
          <View
            style={[
              s.nightGuardPillsRow,
              { backgroundColor: colors.card, borderColor: colors.line },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[s.nightGuardLabel, { color: colors.dim, marginBottom: 0 }]}>
                MAX RUNTIME LIMIT
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#38BDF8' }}>
                {h.nightGuard.maxHours} Hour{h.nightGuard.maxHours > 1 ? 's' : ''} Limit
              </Text>
            </View>
            <View style={s.hoursRow}>
              {[1, 2, 4, 8].map((hrs) => {
                const active = h.nightGuard.maxHours === hrs;
                return (
                  <Press
                    key={hrs}
                    onPress={() => {
                      tap();
                      h.setNightGuard({ enabled: true, maxHours: hrs });
                    }}
                    style={[
                      s.hourPill,
                      {
                        backgroundColor: active ? 'rgba(56, 189, 248, 0.18)' : colors.surface,
                        borderColor: active ? '#38BDF8' : colors.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hourText,
                        {
                          color: active ? '#38BDF8' : colors.dim,
                          fontWeight: active ? '700' : '500',
                        },
                      ]}
                    >
                      {hrs} hr{hrs > 1 ? 's' : ''}
                    </Text>
                  </Press>
                );
              })}
            </View>
          </View>
        )}
      </Section>

      {/* Smart Notifications Section */}
      <Section
        i={4}
        title="SMART NOTIFICATIONS"
        icon="notifications"
        iconColor="#F59E0B"
        dimColor={colors.dim}
        colors={colors}
      >
        {/* Master Toggle */}
        <Press
          style={[
            s.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 6,
              elevation: 2,
            },
          ]}
          onPress={() => {
            tap();
            h.updateNotificationPrefs({ enabled: !h.notificationPrefs.enabled });
          }}
        >
          <View style={s.rowLeft}>
            <View style={[s.rowIconBox, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name="notifications" size={16} color="#F59E0B" />
            </View>
            <View>
              <Text style={[s.rowLabel, { color: colors.text }]}>Push & Smart Alerts</Text>
            </View>
          </View>
          <Toggle value={h.notificationPrefs.enabled} colors={colors} activeColor="#F59E0B" />
        </Press>

        {h.notificationPrefs.enabled && (
          <>
            {/* Night Check (10:00 PM) */}
            <Press
              style={[
                s.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.line,
                },
              ]}
              onPress={() => {
                tap();
                h.updateNotificationPrefs({ nightReminder: !h.notificationPrefs.nightReminder });
              }}
            >
              <View style={s.rowLeft}>
                <View style={[s.rowIconBox, { backgroundColor: '#8B5CF618' }]}>
                  <Ionicons name="moon-outline" size={16} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={[s.rowLabel, { color: colors.text }]}>🌙 Night Sleep-Check (10:00 PM)</Text>
                </View>
              </View>
              <Toggle value={h.notificationPrefs.nightReminder} colors={colors} activeColor="#8B5CF6" />
            </Press>

            {/* Morning Routine (8:00 AM) */}
            <Press
              style={[
                s.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.line,
                },
              ]}
              onPress={() => {
                tap();
                h.updateNotificationPrefs({ morningDigest: !h.notificationPrefs.morningDigest });
              }}
            >
              <View style={s.rowLeft}>
                <View style={[s.rowIconBox, { backgroundColor: '#FF950018' }]}>
                  <Ionicons name="sunny-outline" size={16} color="#FF9500" />
                </View>
                <View>
                  <Text style={[s.rowLabel, { color: colors.text }]}>☀️ Morning Routine (8:00 AM)</Text>
                </View>
              </View>
              <Toggle value={h.notificationPrefs.morningDigest} colors={colors} activeColor="#FF9500" />
            </Press>

            {/* Timer Completion Alerts */}
            <Press
              style={[
                s.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.line,
                },
              ]}
              onPress={() => {
                tap();
                h.updateNotificationPrefs({ timerAlerts: !h.notificationPrefs.timerAlerts });
              }}
            >
              <View style={s.rowLeft}>
                <View style={[s.rowIconBox, { backgroundColor: '#06D6A018' }]}>
                  <Ionicons name="timer-outline" size={16} color="#06D6A0" />
                </View>
                <View>
                  <Text style={[s.rowLabel, { color: colors.text }]}>⏱️ Timer Completion Alerts</Text>
                </View>
              </View>
              <Toggle value={h.notificationPrefs.timerAlerts} colors={colors} activeColor="#06D6A0" />
            </Press>

            {/* Device Token Status & Instant Test Button */}
            <View
              style={[
                s.notifTestCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.line,
                },
              ]}
            >
              <View style={s.notifStatusHeader}>
                <View style={s.notifStatusDotRow}>
                  <View
                    style={[
                      s.notifStatusDot,
                      {
                        backgroundColor: h.notificationPrefs.permissionGranted
                          ? '#06D6A0'
                          : '#F59E0B',
                      },
                    ]}
                  />
                  <Text style={[s.notifStatusText, { color: colors.text }]}>
                    {h.notificationPrefs.permissionGranted
                      ? 'Mobile Alerts Active & Ready'
                      : 'Notification Permission Pending'}
                  </Text>
                </View>
              </View>

              <Press
                onPress={() => h.sendTestNotification()}
                style={[
                  s.testNotifBtn,
                  { backgroundColor: `${colors.lamp}20`, borderColor: colors.lamp },
                ]}
              >
                <Ionicons name="paper-plane-outline" size={16} color={colors.lamp} />
                <Text style={[s.testNotifBtnText, { color: colors.lamp }]}>
                  Send Test Notification
                </Text>
              </Press>
            </View>
          </>
        )}
      </Section>

      {/* System Status Section with Interactive Bluetooth Discovery */}
      <Section
        i={5}
        title="SYSTEM STATUS"
        icon="shield-checkmark"
        iconColor="#06D6A0"
        dimColor={colors.dim}
        colors={colors}
      >
        <Press
          onPress={() => {
            tap();
            setBleModalOpen(true);
          }}
          style={[
            s.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 6,
              elevation: 2,
            },
          ]}
        >
          <View style={s.rowLeft}>
            <View style={[s.rowIconBox, { backgroundColor: '#06D6A018' }]}>
              <Ionicons name="home-outline" size={16} color="#06D6A0" />
            </View>
            <Text style={[s.rowLabel, { color: colors.text }]}>Network Hub</Text>
          </View>
          <StatusPill
            label={h.ready ? 'Connected' : !h.brokerUp ? 'Syncing…' : 'Offline'}
            good={h.ready}
            colors={colors}
            onPress={() => {
              tap();
              setBleModalOpen(true);
            }}
          />
        </Press>

        <Press
          onPress={() => {
            tap();
            setBleModalOpen(true);
          }}
        >
          <StatusRow
            icon="bluetooth-outline"
            iconColor="#38BDF8"
            label="Device & Pairing Hub"
            value="Open Hub"
            valueColor="#38BDF8"
            cardBg={colors.card}
            lineColor={colors.line}
            textColor={colors.text}
            dimColor={colors.dim}
          />
        </Press>

        <StatusRow
          icon="cloud-done-outline"
          iconColor="#38BDF8"
          label="Cloud Sync"
          value={h.brokerUp ? 'Encrypted & Active' : 'Connecting...'}
          valueColor={h.brokerUp ? colors.ok : colors.bad}
          cardBg={colors.card}
          lineColor={colors.line}
          textColor={colors.text}
          dimColor={colors.dim}
        />

        <Press
          onPress={() => {
            tap();
            setWifiModalOpen(true);
          }}
        >
          <StatusRow
            icon="wifi"
            iconColor="#06D6A0"
            label="Device Wi-Fi Setup"
            value={
              h.wifiStatus === 'connected'
                ? h.wifiSsid || 'Connected'
                : h.wifiStatus === 'connecting'
                ? 'Connecting…'
                : 'Configure'
            }
            valueColor={h.wifiStatus === 'connected' ? colors.ok : '#06D6A0'}
            cardBg={colors.card}
            lineColor={colors.line}
            textColor={colors.text}
            dimColor={colors.dim}
          />
        </Press>

        <StatusRow
          icon="hardware-chip-outline"
          iconColor="#06D6A0"
          label="Smart Controller"
          value={h.deviceUp ? 'Online & Ready' : 'Standby'}
          valueColor={h.deviceUp ? colors.ok : colors.dim}
          cardBg={colors.card}
          lineColor={colors.line}
          textColor={colors.text}
          dimColor={colors.dim}
        />

        <Press
          onPress={() => {
            tap();
            setWhatsNewModalOpen(true);
          }}
        >
          <StatusRow
            icon="sparkles-outline"
            iconColor="#A855F7"
            label="App Version"
            value="v2.0.3 (Build 2.0.3)"
            valueColor="#A855F7"
            cardBg={colors.card}
            lineColor={colors.line}
            textColor={colors.text}
            dimColor={colors.dim}
          />
        </Press>
      </Section>

      {/* Hardware Setup & Multi-Channel Test Wizard Modal */}
      <DeviceConnectModal
        visible={deviceModalOpen || h.deviceConnectModalOpen}
        onClose={() => {
          setDeviceModalOpen(false);
          h.closeDeviceConnectModal();
        }}
        onOpenWifi={() => setWifiModalOpen(true)}
      />

      {/* Bluetooth Discovery Modal */}
      <BluetoothModal visible={bleModalOpen} onClose={() => setBleModalOpen(false)} />

      {/* Device Wi-Fi Provisioning Modal */}
      <WifiModal visible={wifiModalOpen} onClose={() => setWifiModalOpen(false)} />

      {/* What's New v2.0 Release Notes Modal */}
      <WhatsNewModal visible={whatsNewModalOpen} onClose={() => setWhatsNewModalOpen(false)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  group: { gap: 10 },
  segmentContainer: {
    height: 54,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    left: 5,
    top: 5,
    bottom: 5,
    borderRadius: 17,
    borderWidth: 1.5,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: '100%',
    zIndex: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  fieldIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowValue: { fontSize: 14, maxWidth: '50%' },
  nightGuardPillsRow: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  nightGuardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  hourPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  hourText: {
    fontSize: 13,
  },
  accountCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
    gap: 3,
  },
  accountBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  accountName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  accountSub: {
    fontSize: 12,
  },
  accountDivider: {
    height: 1,
    marginVertical: 14,
  },
  accountActions: {
    width: '100%',
  },
  accountBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    gap: 8,
  },
  accountBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  accountBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  accountBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    gap: 6,
  },
  accountBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  switchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  switchCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  switchCardSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputBlock: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 2,
  },
  inputFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 46,
  },
  cleanInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  chipsScroll: {
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roomChipText: {
    fontSize: 11,
  },
  notifTestCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  notifStatusHeader: {
    gap: 4,
  },
  notifStatusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  testNotifBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
