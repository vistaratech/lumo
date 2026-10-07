import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, tap } from './theme';
import { useHome } from './useHome';

interface WhatsNewModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FeatureItem {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tag: string;
  title: string;
  desc: string;
}

const V20_FEATURES: FeatureItem[] = [
  {
    icon: 'wifi',
    color: '#06D6A0',
    tag: 'NEW FEATURE',
    title: 'In-App 2.4 GHz Wi-Fi Live Scanner',
    desc: 'Scan nearby Wi-Fi networks in real-time, view live signal bars (RSSI), and configure your ESP32 with 1-tap seamless pairing.',
  },
  {
    icon: 'globe-outline',
    color: '#0084FF',
    tag: 'CLOUD SYNC',
    title: 'Global Remote SIM / Mobile Data Access',
    desc: 'Control all switches from anywhere in the world over 4G/5G mobile data using secure, encrypted MQTT cloud dispatch.',
  },
  {
    icon: 'save-outline',
    color: '#8B5CF6',
    tag: 'HARDWARE FLASH',
    title: 'Permanent NVS Flash Memory Storage',
    desc: 'ESP32 permanently stores Wi-Fi credentials in hardware flash memory, automatically reconnecting even after power cuts or restarts.',
  },
  {
    icon: 'bluetooth',
    color: '#38BDF8',
    tag: 'CONNECTIVITY',
    title: 'Silent Bluetooth Auto-Reconnect',
    desc: 'Zero manual clicks needed. App automatically reconnects to your ESP32 controller in the background on launch and app resume.',
  },
  {
    icon: 'timer-outline',
    color: '#EC4899',
    tag: 'PERSISTENCE',
    title: 'Persistent Smart Timers',
    desc: 'Timers now survive app kills, restarts, and backgrounding with millisecond timestamp synchronization and local storage.',
  },
  {
    icon: 'sparkles-outline',
    color: '#F59E0B',
    tag: 'MOTION & PHYSICS',
    title: 'Apple-Grade Cubic Easing Animations',
    desc: 'Removed all jittery spring oscillations. Switches, sheets, and cards now glide smoothly with silky cubic bezier curves.',
  },
  {
    icon: 'flash-outline',
    color: '#10B981',
    tag: 'ZERO LATENCY',
    title: 'Instant CoreBluetooth GATT Dispatch',
    desc: 'Direct CoreBluetooth GATT dispatch eliminates relay toggle lag for instant sub-millisecond hardware trigger and vibration feedback.',
  },
  {
    icon: 'color-palette-outline',
    color: '#F43F5E',
    tag: 'CUSTOMIZATION',
    title: 'Custom Switch Names & Adaptive Themes',
    desc: 'Personalize names for all 4 channels with automatic persistence, accompanied by animated Dark, Light, and System theme modes.',
  },
];

export default function WhatsNewModal({ visible, onClose }: WhatsNewModalProps) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.modalOverlay}>
        {/* Dimmed Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(180)}
            style={[s.backdrop, { backgroundColor: isDark ? 'rgba(3, 7, 18, 0.75)' : 'rgba(15, 23, 42, 0.55)' }]}
          />
        </Pressable>

        {/* Modal Container */}
        <Animated.View
          entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
          style={[
            s.sheet,
            {
              backgroundColor: isDark ? '#0D1424' : '#FFFFFF',
              borderColor: isDark ? '#1F2A3F' : '#E2E8F0',
              paddingBottom: Math.max(insets.bottom, 18),
              maxHeight: height * 0.9,
              width: isDesktop ? 540 : '100%',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderRadius: isDesktop ? 28 : undefined,
              marginBottom: isDesktop ? 'auto' : 0,
              marginTop: isDesktop ? 'auto' : undefined,
            },
          ]}
        >
          {/* Header Bar */}
          <View style={[s.header, { borderBottomColor: isDark ? '#1F2A3F' : '#E2E8F0' }]}>
            <View style={s.headerLeft}>
              <View style={[s.rocketIconBadge, { backgroundColor: '#8B5CF622' }]}>
                <Ionicons name="rocket-outline" size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text style={[s.title, { color: colors.text }]}>What's New in v2.0</Text>
                <Text style={[s.sub, { color: colors.dim }]}>Major Release • Hardware & Cloud Upgrades</Text>
              </View>
            </View>

            <Press
              onPress={() => {
                tap();
                onClose();
              }}
              style={[s.closeBtn, { backgroundColor: isDark ? '#1B2438' : '#F1F5F9' }]}
            >
              <Ionicons name="close" size={18} color={colors.dim} />
            </Press>
          </View>

          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Version Release Hero Banner */}
            <View
              style={[
                s.heroBanner,
                {
                  backgroundColor: isDark ? '#141C30' : '#F8FAFC',
                  borderColor: isDark ? '#26344E' : '#E2E8F0',
                },
              ]}
            >
              <View style={s.heroTop}>
                <View style={s.versionPill}>
                  <Ionicons name="sparkles" size={12} color="#F59E0B" />
                  <Text style={s.versionPillText}>v2.0.0 Official Release</Text>
                </View>
                <Text style={[s.heroDate, { color: colors.dim }]}>Build 2.0.0 Stable</Text>
              </View>
              <Text style={[s.heroTitle, { color: colors.text }]}>
                Next-Gen Hybrid Wi-Fi, BLE & Cloud Control
              </Text>
              <Text style={[s.heroDesc, { color: colors.dim }]}>
                Lumo v2.0 brings complete in-app ESP32 Wi-Fi setup, worldwide cellular access over SIM data, permanent flash storage, and silky-smooth Apple easing.
              </Text>
            </View>

            {/* Feature List */}
            <View style={s.featureList}>
              {V20_FEATURES.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    s.featureCard,
                    {
                      backgroundColor: isDark ? '#111827' : '#F8FAFC',
                      borderColor: isDark ? '#1F2A3F' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={[s.featureIconBox, { backgroundColor: `${item.color}18` }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={s.featureContent}>
                    <View style={s.featureHeader}>
                      <Text style={[s.featureTitle, { color: colors.text }]}>{item.title}</Text>
                      <View style={[s.featureTag, { backgroundColor: `${item.color}1A` }]}>
                        <Text style={[s.featureTagText, { color: item.color }]}>{item.tag}</Text>
                      </View>
                    </View>
                    <Text style={[s.featureDesc, { color: colors.dim }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={[s.footer, { borderTopColor: isDark ? '#1F2A3F' : '#E2E8F0' }]}>
            <Press
              onPress={() => {
                tap();
                onClose();
              }}
              style={[s.doneBtn, { backgroundColor: '#8B5CF6' }]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={s.doneBtnText}>Got it, Close</Text>
            </Press>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    width: '100%',
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rocketIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  heroBanner: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  versionPillText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  heroDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  featureList: {
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
    gap: 4,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  featureTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  featureTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
