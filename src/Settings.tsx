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
import { CHANNELS } from './config';
import { Header, Press, StatusPill, ThemeColors, ThemeMode, Toggle, tap } from './theme';
import { useHome } from './useHome';
import BluetoothModal from './BluetoothModal';
import WifiModal from './WifiModal';
import WhatsNewModal from './WhatsNewModal';

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

function NameField({ channel }: { channel: (typeof CHANNELS)[number] }) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const id = channel.id;
  const focus = useSharedValue(0);

  const accentColor = isDark ? channel.color : channel.colorLight;

  const box = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [colors.line, accentColor]),
  }));

  return (
    <Animated.View
      style={[
        s.field,
        {
          backgroundColor: colors.card,
          borderColor: colors.line,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        },
        box,
      ]}
    >
      <View style={[s.fieldIconWrap, { backgroundColor: `${accentColor}18` }]}>
        <Ionicons name={channel.icon as any} size={18} color={accentColor} />
      </View>
      <TextInput
        value={h.names[id]}
        onChangeText={(t) => h.setName(id, t)}
        onFocus={() => (focus.value = withTiming(1, { duration: 200 }))}
        onBlur={() => (focus.value = withTiming(0, { duration: 200 }))}
        maxLength={20}
        selectionColor={accentColor}
        placeholder={`Switch ${id}`}
        placeholderTextColor={colors.dim}
        style={[s.input, { color: colors.text }]}
      />
    </Animated.View>
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

export default function Settings() {
  const h = useHome();
  const colors = h.colors;
  const [bleModalOpen, setBleModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [whatsNewModalOpen, setWhatsNewModalOpen] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 150 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Header title="Settings" sub="Personalize your home control" colors={colors} />

      {/* Appearance Segment Control */}
      <Section
        i={0}
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

      {/* Switch Names Section */}
      <Section
        i={1}
        title="SWITCH NAMES"
        icon="pricetags"
        iconColor="#FF9500"
        dimColor={colors.dim}
        colors={colors}
      >
        {CHANNELS.map((ch) => (
          <NameField key={ch.id} channel={ch} />
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

      {/* System Status Section with Interactive Bluetooth Discovery */}
      <Section
        i={3}
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
            value="v2.0 (Build 2.0.0)"
            valueColor="#A855F7"
            cardBg={colors.card}
            lineColor={colors.line}
            textColor={colors.text}
            dimColor={colors.dim}
          />
        </Press>
      </Section>

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
});
