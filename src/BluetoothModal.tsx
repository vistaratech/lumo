import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, notify, tap } from './theme';
import { useHome } from './useHome';
import WifiModal from './WifiModal';
import {
  BluetoothDeviceInfo,
  checkBluetoothState,
  connectNativeBleDevice,
  disconnectBluetoothDevice,
  getBleManager,
  isWebBluetoothSupported,
  requestBluetoothDevice,
  scanNativeDevices,
} from './bluetooth';

type Phase = 'IDLE' | 'SCANNING' | 'CONNECTED' | 'NOT_FOUND' | 'EXPO_GO_INFO';

export default function BluetoothModal({
  visible,
  onClose,
  onOpenWifi,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenWifi?: () => void;
}) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 560;

  // ── States ──
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [isConnecting, setIsConnecting] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<BluetoothDeviceInfo | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nativeScanCleanupRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lightweight High-Performance Pulse Ring ──
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );
    } else {
      cancelAnimation(pulse);
      if (nativeScanCleanupRef.current) {
        nativeScanCleanupRef.current();
        nativeScanCleanupRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      setIsConnecting(false);
      setErrorMsg(null);
      setDiscoveredDevices([]);
    }
  }, [visible]);

  const ring1 = useAnimatedStyle(() => ({
    opacity: 0.65 * (1 - pulse.value),
    transform: [{ scale: 0.7 + 1.4 * pulse.value }],
  }));

  const ring2 = useAnimatedStyle(() => {
    const p2 = (pulse.value + 0.5) % 1;
    return {
      opacity: 0.65 * (1 - p2),
      transform: [{ scale: 0.7 + 1.4 * p2 }],
    };
  });

  // ── Handle Connect click (Web Bluetooth & Real Native Scan) ──
  const handleConnect = useCallback(async () => {
    tap();
    setIsConnecting(true);
    setErrorMsg(null);
    setDiscoveredDevices([]);

    // ── 1. WEB BROWSER (Chrome / Edge) ──
    if (Platform.OS === 'web') {
      try {
        if (!isWebBluetoothSupported()) {
          setErrorMsg(
            'Web Bluetooth is not supported in this browser. Please open in Google Chrome or Microsoft Edge.'
          );
          setIsConnecting(false);
          return;
        }

        // Opens Chrome's native pairing popup ("<domain> wants to pair")
        const device = await requestBluetoothDevice();

        setPairedDevice(device);
        setPhase('CONNECTED');
        notify('success');
      } catch (err: any) {
        if (
          err?.name === 'NotFoundError' ||
          err?.message?.includes('User cancelled') ||
          err?.message?.includes('cancelled')
        ) {
          // User closed the pairing dialog or no device chosen
        } else if (err?.message?.includes('Bluetooth adapter not available')) {
          setErrorMsg(
            'Bluetooth is disabled on your computer or device. Please turn on Bluetooth in settings.'
          );
        } else {
          setErrorMsg(err?.message || 'Bluetooth connection failed.');
        }
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // ── 2. MOBILE (React Native / Expo) ──
    // Check if running in Expo Go where native BLE libraries are disabled
    const manager = getBleManager();
    if (!manager) {
      setIsConnecting(false);
      setPhase('EXPO_GO_INFO');
      return;
    }

    // Real Native BLE Scanning (Dev Client / APK)
    const state = await checkBluetoothState();
    if (state === 'off') {
      setErrorMsg('Bluetooth is turned off. Please turn on Bluetooth in device settings.');
      setIsConnecting(false);
      return;
    }

    setPhase('SCANNING');
    const foundMap = new Map<string, BluetoothDeviceInfo>();

    const stopScan = scanNativeDevices(
      (device) => {
        foundMap.set(device.id, device);
        setDiscoveredDevices(Array.from(foundMap.values()));
      },
      (scanError) => {
        if (scanError === 'EXPO_GO_BLE_UNSUPPORTED') {
          setPhase('EXPO_GO_INFO');
        } else {
          setErrorMsg(scanError);
        }
        setIsConnecting(false);
      }
    );

    nativeScanCleanupRef.current = stopScan;

    // Scan for 6 seconds; if no device found, stop scan and show "Not Found"
    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
      nativeScanCleanupRef.current = null;
      setIsConnecting(false);
      if (foundMap.size === 0) {
        setPhase('NOT_FOUND');
      }
    }, 6000);
  }, [h]);

  // ── Connect to a discovered native device ──
  const handleSelectDevice = useCallback(
    async (device: BluetoothDeviceInfo) => {
      tap();
      setIsConnecting(true);
      setErrorMsg(null);
      try {
        const success = await connectNativeBleDevice(device.rawDevice);
        if (success) {
          setPairedDevice({ ...device, connected: true });
          setPhase('CONNECTED');
          notify('success');
          h.reconnect();
        } else {
          setErrorMsg('Failed to link Lumo BLE service. Ensure ESP32 is powered and in range.');
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to connect to device');
      } finally {
        setIsConnecting(false);
      }
    },
    [h]
  );

  // ── Handle Disconnect ──
  const handleDisconnect = useCallback(async () => {
    tap();
    await disconnectBluetoothDevice(pairedDevice?.rawDevice);
    setPairedDevice(null);
    setDiscoveredDevices([]);
    setPhase('IDLE');
    setErrorMsg(null);
  }, [pairedDevice]);

  if (!visible) return null;

  const isConnected = phase === 'CONNECTED';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          s.backdrop,
          {
            justifyContent: isDesktop ? 'center' : 'flex-end',
            alignItems: 'center',
            padding: isDesktop ? 20 : 0,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(150)}
          style={[
            s.dialog,
            {
              backgroundColor: isDark ? '#121726' : '#FFFFFF',
              borderColor: isDark ? '#1E273A' : '#E2E8F0',
              borderRadius: isDesktop ? 28 : 0,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: height * 0.88,
              paddingBottom: isDesktop ? 24 : Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          {/* Top handle bar */}
          <View style={[s.handle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />

          {/* ── Center Scanning Radar Visual ── */}
          <View style={s.radarSection}>
            <View style={s.radarContainer}>
              {!isConnected && phase !== 'EXPO_GO_INFO' && phase !== 'NOT_FOUND' && (
                <>
                  <Animated.View style={[s.radarRing, ring1]} />
                  <Animated.View style={[s.radarRing, ring2]} />
                </>
              )}

              <View
                style={[
                  s.radarCenter,
                  {
                    backgroundColor: isConnected
                      ? '#06D6A018'
                      : phase === 'NOT_FOUND' || phase === 'EXPO_GO_INFO'
                      ? '#F59E0B18'
                      : '#0084FF18',
                    borderColor: isConnected
                      ? '#06D6A0'
                      : phase === 'NOT_FOUND' || phase === 'EXPO_GO_INFO'
                      ? '#F59E0B'
                      : '#0084FF',
                  },
                ]}
              >
                <Ionicons
                  name={
                    isConnected
                      ? 'checkmark-circle'
                      : phase === 'NOT_FOUND'
                      ? 'search'
                      : phase === 'EXPO_GO_INFO'
                      ? 'information-circle'
                      : 'bluetooth'
                  }
                  size={32}
                  color={
                    isConnected
                      ? '#06D6A0'
                      : phase === 'NOT_FOUND' || phase === 'EXPO_GO_INFO'
                      ? '#F59E0B'
                      : '#0084FF'
                  }
                />
              </View>
            </View>

            {/* Title & Description */}
            <Text style={[s.modalTitle, { color: colors.text }]}>
              {isConnected
                ? 'Connected to Device'
                : phase === 'SCANNING'
                ? 'Scanning for Real Devices…'
                : phase === 'NOT_FOUND'
                ? 'No Real Devices Found'
                : phase === 'EXPO_GO_INFO'
                ? 'Expo Go Limitation'
                : 'Connect to Lumo'}
            </Text>

            {phase === 'EXPO_GO_INFO' ? (
              <Text style={[s.modalDesc, { color: colors.dim }]}>
                Real BLE requires standalone app build or Chrome browser.
              </Text>
            ) : phase === 'NOT_FOUND' ? (
              <Text style={[s.modalDesc, { color: colors.dim }]}>
                Ensure ESP32 is powered on nearby.
              </Text>
            ) : null}

            {/* Error Banner */}
            {errorMsg && (
              <Animated.View entering={FadeIn.duration(200)} style={s.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={s.errorText}>{errorMsg}</Text>
              </Animated.View>
            )}
          </View>

          {/* ── Content Section ── */}
          {isConnected && pairedDevice ? (
            /* 1. Connected Device Card */
            <Animated.View entering={FadeIn.duration(250)} style={s.deviceCardWrapper}>
              <View
                style={[
                  s.deviceCard,
                  {
                    backgroundColor: isDark ? '#162032' : '#F8FAFC',
                    borderColor: '#06D6A0',
                  },
                ]}
              >
                <View style={s.deviceCardLeft}>
                  <View style={[s.deviceIconBox, { backgroundColor: '#06D6A020' }]}>
                    <Ionicons name="hardware-chip-outline" size={22} color="#06D6A0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.deviceNameRow}>
                      <Text style={[s.deviceName, { color: colors.text }]}>
                        {pairedDevice.name}
                      </Text>
                      <View style={s.connectedPill}>
                        <Text style={s.connectedPillText}>CONNECTED</Text>
                      </View>
                    </View>
                    <Text style={[s.deviceDetails, { color: colors.dim }]}>
                      Bluetooth LE • Active
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.actions}>
                <Press
                  onPress={() => {
                    tap();
                    onClose();
                    if (onOpenWifi) {
                      setTimeout(onOpenWifi, 250);
                    }
                  }}
                  style={[s.primaryBtn, { backgroundColor: '#0084FF', borderColor: '#0084FF' }]}
                >
                  <Ionicons name="wifi" size={16} color="#FFF" />
                  <Text style={s.primaryBtnText}>Setup Device Wi-Fi</Text>
                </Press>

                <Press
                  onPress={onClose}
                  style={[s.primaryBtn, { backgroundColor: '#06D6A0', borderColor: '#06D6A0' }]}
                >
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                  <Text style={s.primaryBtnText}>Done</Text>
                </Press>

                <Press onPress={handleDisconnect} style={s.secondaryBtn}>
                  <Text style={[s.secondaryBtnText, { color: '#EF4444' }]}>
                    Disconnect Device
                  </Text>
                </Press>
              </View>
            </Animated.View>
          ) : discoveredDevices.length > 0 ? (
            /* 2. Discovered Real Devices List */
            <View style={{ width: '100%', gap: 10, marginVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.dim }}>
                Discovered Devices ({discoveredDevices.length}):
              </Text>
              {discoveredDevices.map((dev) => (
                <Press
                  key={dev.id}
                  onPress={() => handleSelectDevice(dev)}
                  style={[
                    s.deviceCard,
                    {
                      backgroundColor: isDark ? '#162032' : '#F8FAFC',
                      borderColor: colors.line,
                      marginBottom: 6,
                    },
                  ]}
                >
                  <View style={s.deviceCardLeft}>
                    <View style={[s.deviceIconBox, { backgroundColor: '#0084FF20' }]}>
                      <Ionicons name="bluetooth" size={20} color="#0084FF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.deviceName, { color: colors.text }]}>{dev.name}</Text>
                      <Text style={[s.deviceDetails, { color: colors.dim }]}>Tap to connect</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.dim} />
                  </View>
                </Press>
              ))}
              <Press
                onPress={onClose}
                style={[s.secondaryBtn, { backgroundColor: 'transparent' }]}
              >
                <Text style={[s.secondaryBtnText, { color: colors.dim }]}>Cancel</Text>
              </Press>
            </View>
          ) : phase === 'EXPO_GO_INFO' ? (
            /* 3. Expo Go Notice */
            <View style={s.actions}>
              <View
                style={[
                  s.infoBox,
                  {
                    backgroundColor: isDark ? '#1A2333' : '#F1F5F9',
                    borderColor: isDark ? '#26354D' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={[s.infoBoxTitle, { color: colors.text }]}>
                  Why does Expo Go not scan?
                </Text>
                <Text style={[s.infoBoxDesc, { color: colors.dim }]}>
                  Expo Go is a sandboxed client app that does not bundle native BLE drivers.
                  To test real hardware scanning:
                  {'\n'}• Open this app in your phone's Chrome browser (`npm run web`).
                  {'\n'}• Or build a native development build using `npx expo run:android`.
                </Text>
              </View>

              <Press
                onPress={onClose}
                style={[
                  s.primaryBtn,
                  { backgroundColor: '#0084FF', borderColor: '#0084FF' },
                ]}
              >
                <Text style={s.primaryBtnText}>Understood</Text>
              </Press>
            </View>
          ) : (
            /* 4. Idle / Ready / Not Found State */
            <View style={s.actions}>
              <Press
                onPress={handleConnect}
                disabled={isConnecting}
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: '#0084FF',
                    borderColor: '#0084FF',
                    opacity: isConnecting ? 0.85 : 1,
                  },
                ]}
              >
                {isConnecting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={s.primaryBtnText}>Scanning for devices…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="bluetooth" size={17} color="#FFF" />
                    <Text style={s.primaryBtnText}>
                      {phase === 'NOT_FOUND' ? 'Scan Again' : 'Connect'}
                    </Text>
                  </>
                )}
              </Press>

              <Press
                onPress={onClose}
                disabled={isConnecting}
                style={[
                  s.secondaryBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
              >
                <Text style={[s.secondaryBtnText, { color: colors.text }]}>Cancel</Text>
              </Press>
            </View>
          )}

          {/* ── Footer ── */}
          <View style={[s.footer, { borderTopColor: isDark ? '#1C2538' : '#F1F5F9' }]}>
            <View
              style={[
                s.footerDot,
                { backgroundColor: h.ready ? '#06D6A0' : h.brokerUp ? '#F59E0B' : colors.dimmer },
              ]}
            />
            <Text style={[s.footerText, { color: colors.dim }]}>
              {h.ready
                ? 'Cloud & Controller synced'
                : h.brokerUp
                ? 'Cloud active • Local mode'
                : 'Real Device Scanner Active'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 28,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },

  /* Radar section */
  radarSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  radarContainer: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  radarRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: '#0084FF',
  },
  radarCenter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0084FF',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    maxWidth: 320,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  /* Buttons */
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Info Box */
  infoBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoBoxDesc: {
    fontSize: 12,
    lineHeight: 18,
  },

  /* Device card */
  deviceCardWrapper: {
    width: '100%',
  },
  deviceCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    width: '100%',
    marginBottom: 14,
  },
  deviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
  },
  deviceDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  connectedPill: {
    backgroundColor: 'rgba(6, 214, 160, 0.18)',
    borderColor: 'rgba(6, 214, 160, 0.45)',
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  connectedPillText: {
    color: '#06D6A0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
