import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { DEVICE_MODELS, DeviceModel, generateChannels } from './config';
import { Glow, Press, notify, tap } from './theme';
import { useHome } from './useHome';
import {
  BluetoothDeviceInfo,
  addBleDataListener,
  connectNativeBleDevice,
  isBleConnected,
  isWebBluetoothSupported,
  requestBluetoothDevice,
  scanNativeDevices,
  sendBleCommand,
} from './bluetooth';

type Step = 1 | 2 | 3;

export default function DeviceConnectModal({
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

  // Wizard Steps: 1 = Auto-Detect Hardware, 2 = Test Relays, 3 = Complete
  const [step, setStep] = useState<Step>(1);
  const [selectedModel, setSelectedModel] = useState<DeviceModel>(
    h.selectedModel || DEVICE_MODELS[1]
  );
  const [verifiedSwitches, setVerifiedSwitches] = useState<Record<number, boolean>>({});
  const [verifyingChannelId, setVerifyingChannelId] = useState<number | null>(null);
  const [channelErrors, setChannelErrors] = useState<Record<number, string>>({});
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [autoDetectedSuccess, setAutoDetectedSuccess] = useState(false);

  // Bluetooth Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nativeScanCleanupRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Liquid Ambient Breathing Animations
  const pulse = useSharedValue(0);
  const liquidBreathe = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      if (h.detectedHardwareChannels) {
        const found = DEVICE_MODELS.find((m) => m.channels === h.detectedHardwareChannels);
        if (found) setSelectedModel(found);
      } else if (h.selectedModel) {
        setSelectedModel(h.selectedModel);
      }
      setVerifiedSwitches({});
      setVerifyingChannelId(null);
      setChannelErrors({});
      setErrorMsg(null);
      setShowManualOverride(false);
      setAutoDetectedSuccess(h.bleActive);

      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1900, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );

      liquidBreathe.value = withRepeat(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );

      // If already connected on open, query hardware identification immediately
      if (h.bleActive) {
        sendBleCommand('IDENTIFY').catch(() => {});
        sendBleCommand('STATUS').catch(() => {});
      }
    } else {
      cancelAnimation(pulse);
      cancelAnimation(liquidBreathe);
      stopScan();
      setStep(1);
    }
  }, [visible]);

  // Listen to real physical BLE responses (R1:1, R2:0) from ESP32
  useEffect(() => {
    const unsub = addBleDataListener((msg) => {
      if (typeof msg !== 'string') return;

      const rMatches = [...msg.matchAll(/R(\d+):([01])/g)];
      if (rMatches.length > 0) {
        rMatches.forEach((m) => {
          const chId = parseInt(m[1], 10);
          setVerifiedSwitches((prev) => ({ ...prev, [chId]: true }));
          setChannelErrors((prev) => {
            const next = { ...prev };
            delete next[chId];
            return next;
          });
        });

        setVerifyingChannelId((curr) => {
          if (curr !== null && rMatches.some((m) => parseInt(m[1], 10) === curr)) {
            notify('success');
            return null;
          }
          return curr;
        });

        if (verifyTimeoutRef.current) {
          clearTimeout(verifyTimeoutRef.current);
          verifyTimeoutRef.current = null;
        }
      }
    });

    return () => unsub();
  }, []);

  // Auto-sync model when hardware self-announces its channel count over BLE
  useEffect(() => {
    if (h.detectedHardwareChannels) {
      const found = DEVICE_MODELS.find((m) => m.channels === h.detectedHardwareChannels);
      if (found && found.id !== selectedModel.id) {
        setSelectedModel(found);
        setAutoDetectedSuccess(true);
        notify('success');
      }
    } else if (h.selectedModel && h.selectedModel.channels !== selectedModel.channels) {
      setSelectedModel(h.selectedModel);
      setAutoDetectedSuccess(true);
      notify('success');
    }
  }, [h.detectedHardwareChannels, h.selectedModel]);

  // Radar Styles
  const ring1 = useAnimatedStyle(() => ({
    opacity: 0.65 * (1 - pulse.value),
    transform: [{ scale: 0.7 + 1.3 * pulse.value }],
  }));

  const ring2 = useAnimatedStyle(() => {
    const p2 = (pulse.value + 0.5) % 1;
    return {
      opacity: 0.45 * (1 - p2),
      transform: [{ scale: 0.7 + 1.3 * p2 }],
    };
  });

  // Ambient Liquid Floating Orbs Style
  const liquidOrbAStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.9 + 0.2 * liquidBreathe.value },
      { translateY: -10 * liquidBreathe.value },
    ],
    opacity: 0.5 + 0.3 * liquidBreathe.value,
  }));

  const liquidOrbBStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.05 - 0.2 * liquidBreathe.value },
      { translateX: 12 * liquidBreathe.value },
    ],
    opacity: 0.4 + 0.3 * (1 - liquidBreathe.value),
  }));

  const modelChannels = useMemo(() => {
    return generateChannels(selectedModel.channels, h.names, h.rooms);
  }, [selectedModel.channels, h.names, h.rooms]);

  const stopScan = () => {
    if (nativeScanCleanupRef.current) {
      nativeScanCleanupRef.current();
      nativeScanCleanupRef.current = null;
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
  };

  const startScan = async () => {
    setErrorMsg(null);
    setDiscoveredDevices([]);

    if (Platform.OS === 'web') {
      if (!isWebBluetoothSupported()) {
        setErrorMsg('Web Bluetooth requires Google Chrome or Microsoft Edge browser.');
        return;
      }
      setIsConnecting(true);
      try {
        const dev = await requestBluetoothDevice();
        if (dev) {
          notify('success');
          setTimeout(() => {
            sendBleCommand('IDENTIFY').catch(() => {});
            sendBleCommand('STATUS').catch(() => {});
          }, 300);
          setAutoDetectedSuccess(true);
        }
      } catch (err: any) {
        if (!err?.message?.includes('cancelled')) {
          setErrorMsg(err?.message || 'Bluetooth connection failed.');
        }
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // Native Mobile Scan
    setIsScanning(true);
    try {
      const cleanup = scanNativeDevices(
        (dev) => {
          setDiscoveredDevices((prev) => {
            if (prev.some((d) => d.id === dev.id)) return prev;
            return [...prev, dev];
          });
        },
        (err) => {
          setIsScanning(false);
          setErrorMsg(
            typeof err === 'string' ? err : (err as any)?.message || 'Bluetooth scan failed.'
          );
        }
      );
      nativeScanCleanupRef.current = cleanup;

      scanTimeoutRef.current = setTimeout(() => {
        setIsScanning(false);
        if (nativeScanCleanupRef.current) {
          nativeScanCleanupRef.current();
          nativeScanCleanupRef.current = null;
        }
      }, 9000);
    } catch (err: any) {
      setIsScanning(false);
      setErrorMsg(err?.message || 'Could not start Bluetooth scan.');
    }
  };

  const handleSelectDevice = async (dev: BluetoothDeviceInfo) => {
    stopScan();
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const ok = await connectNativeBleDevice(dev.id);
      if (ok) {
        notify('success');
        setTimeout(() => {
          sendBleCommand('IDENTIFY').catch(() => {});
          sendBleCommand('STATUS').catch(() => {});
        }, 300);
        setAutoDetectedSuccess(true);
      } else {
        setErrorMsg(`Failed to connect to ${dev.name}. Ensure ESP32 is powered and in range.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = h.bleActive || isBleConnected();
  const hwChannels = h.detectedHardwareChannels;
  const hasHardwareMismatch =
    isConnected && hwChannels !== null && selectedModel.channels > hwChannels;

  // Real physical testing logic
  const handleTestToggle = (channelId: number) => {
    tap();

    // 1. HARDWARE PROTECTION: Does this channel physically exist on the connected board?
    if (isConnected && hwChannels !== null && channelId > hwChannels) {
      notify('error');
      setChannelErrors((prev) => ({
        ...prev,
        [channelId]: `Relay ${channelId} does NOT physically exist! Your ESP32 board has only ${hwChannels} relays.`,
      }));
      return;
    }

    // 2. Clear any prior error for this channel
    setChannelErrors((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });

    const currentVal = !!h.on[channelId];
    const nextVal = !currentVal;

    if (isConnected) {
      setVerifyingChannelId(channelId);
      h.send(channelId, nextVal);

      if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
      verifyTimeoutRef.current = setTimeout(() => {
        setVerifyingChannelId((curr) => {
          if (curr === channelId) {
            setChannelErrors((prev) => ({
              ...prev,
              [channelId]: `No physical response from Relay ${channelId}. Check ESP32 power.`,
            }));
            return null;
          }
          return curr;
        });
      }, 2500);
    } else {
      // Offline / demo simulation mode without hardware
      h.send(channelId, nextVal);
      setVerifiedSwitches((prev) => ({ ...prev, [channelId]: true }));
    }
  };

  const handleTestAll = (targetState: boolean) => {
    tap();
    const validChannels = modelChannels.filter(
      (ch) => !(isConnected && hwChannels !== null && ch.id > hwChannels)
    );

    validChannels.forEach((ch) => {
      h.send(ch.id, targetState);
      if (!isConnected) {
        setVerifiedSwitches((prev) => ({ ...prev, [ch.id]: true }));
      }
    });

    if (isConnected && validChannels.length > 0) {
      setTimeout(() => {
        sendBleCommand('STATUS').catch(() => {});
      }, 300);
    }
  };

  const handleFinishSetup = async () => {
    tap();
    if (hasHardwareMismatch) {
      notify('error');
      setErrorMsg(
        `Hardware mismatch: Your board physically has only ${hwChannels} relays, but ${selectedModel.name} (${selectedModel.channels} CH) is selected. Please switch to LUMO R${hwChannels}.`
      );
      return;
    }

    const requiredChannels =
      isConnected && hwChannels !== null
        ? Math.min(selectedModel.channels, hwChannels)
        : selectedModel.channels;

    const testedValidCount = modelChannels
      .filter((ch) => ch.id <= requiredChannels)
      .filter((ch) => verifiedSwitches[ch.id]).length;

    if (testedValidCount < requiredChannels) {
      notify('error');
      setErrorMsg(
        `Please test all ${requiredChannels} relays on your board before completing setup.`
      );
      return;
    }

    notify('success');
    await h.setDeviceModel(selectedModel.id);
    setStep(3);
  };

  // Only count verified valid physical channels
  const validModelChannels = modelChannels.filter(
    (ch) => !(isConnected && hwChannels !== null && ch.id > hwChannels)
  );
  const verifiedCount = validModelChannels.filter((ch) => verifiedSwitches[ch.id]).length;
  const targetTestCount = validModelChannels.length;

  if (!visible) return null;

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
        {/* Backdrop Press Dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* ── Modern Liquid Glass Dialog Container ── */}
        <Animated.View
          entering={FadeInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(160)}
          style={[
            s.dialog,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 255, 255, 0.88)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.95)',
              borderRadius: isDesktop ? 32 : 0,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              maxHeight: height * 0.9,
              width: isDesktop ? 520 : '100%',
              paddingBottom: isDesktop ? 24 : Math.max(insets.bottom, 16) + 8,
              ...(Platform.OS === 'web'
                ? {
                    backdropFilter: 'blur(36px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                  }
                : {}),
            },
          ]}
        >
          {/* ── Floating Liquid Light Orbs (Refracts through Frosted Glass) ── */}
          <Animated.View pointerEvents="none" style={[s.liquidOrbA, liquidOrbAStyle]}>
            <Glow id="liquid-glow-a" size={320} color="#06D6A0" opacity={isDark ? 0.35 : 0.18} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[s.liquidOrbB, liquidOrbBStyle]}>
            <Glow id="liquid-glow-b" size={280} color="#0084FF" opacity={isDark ? 0.3 : 0.15} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={s.liquidOrbC}>
            <Glow id="liquid-glow-c" size={220} color="#8B5CF6" opacity={isDark ? 0.22 : 0.12} />
          </Animated.View>

          {/* Top Specular Glass Reflection Edge */}
          <View
            style={[
              s.specularGlassLine,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)' },
            ]}
          />

          {/* Top Sheet Handle (Mobile) */}
          {!isDesktop && (
            <View
              style={[
                s.handle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)' },
              ]}
            />
          )}

          {/* ── Fixed Liquid Glass Header ── */}
          <View
            style={[
              s.header,
              { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
            ]}
          >
            <View style={s.headerLeft}>
              <View
                style={[
                  s.headerIconBadge,
                  {
                    backgroundColor: `${selectedModel.badgeColor}${isDark ? '28' : '18'}`,
                    borderColor: `${selectedModel.badgeColor}${isDark ? '60' : '45'}`,
                  },
                ]}
              >
                <Ionicons name="hardware-chip" size={19} color={selectedModel.badgeColor} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.headerTitleRow}>
                  <Text style={[s.headerTitle, { color: colors.text }]}>Hardware Setup</Text>
                  <View
                    style={[
                      s.headerModelPill,
                      {
                        backgroundColor: `${selectedModel.badgeColor}${isDark ? '30' : '18'}`,
                        borderColor: `${selectedModel.badgeColor}45`,
                      },
                    ]}
                  >
                    <Text style={[s.headerModelPillText, { color: selectedModel.badgeColor }]}>
                      {selectedModel.name}
                    </Text>
                  </View>
                </View>
                <Text style={[s.headerSub, { color: colors.dim }]}>
                  {isConnected
                    ? (h.bleDeviceName || 'Connected')
                    : 'Diagnostics'}
                </Text>
              </View>
            </View>

            <Press
              onPress={onClose}
              style={[
                s.closeBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Ionicons name="close" size={17} color={colors.dim} />
            </Press>
          </View>

          {/* ── Liquid Segmented Glass Stepper Bar ── */}
          <View
            style={[
              s.stepperGlassBar,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
          >
            {[
              { num: 1, label: 'Auto-Detect' },
              { num: 2, label: 'Test Relays' },
              { num: 3, label: 'Ready' },
            ].map((st, i) => {
              const active = step === st.num;
              const done = step > st.num;
              const activeColor = done ? '#06D6A0' : active ? '#0084FF' : colors.dim;

              return (
                <React.Fragment key={st.num}>
                  <View style={s.stepItem}>
                    <View
                      style={[
                        s.stepDot,
                        {
                          backgroundColor: done
                            ? '#06D6A0'
                            : active
                            ? '#0084FF'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                          borderColor: active
                            ? '#0084FF'
                            : done
                            ? '#06D6A0'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.15)'
                            : 'rgba(0, 0, 0, 0.1)',
                          shadowColor: active ? '#0084FF' : done ? '#06D6A0' : 'transparent',
                          shadowOpacity: active || done ? 0.45 : 0,
                          shadowRadius: 8,
                          elevation: active || done ? 4 : 0,
                        },
                      ]}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={11} color="#FFF" />
                      ) : (
                        <Text
                          style={[
                            s.stepDotText,
                            { color: active ? '#FFF' : isDark ? '#94A3B8' : '#64748B' },
                          ]}
                        >
                          {st.num}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        s.stepItemLabel,
                        {
                          color: activeColor,
                          fontWeight: active ? '700' : '500',
                        },
                      ]}
                    >
                      {st.label}
                    </Text>
                  </View>

                  {i < 2 && (
                    <View
                      style={[
                        s.stepConnectorLine,
                        {
                          backgroundColor:
                            step > i + 1
                              ? '#06D6A0'
                              : isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 0, 0, 0.1)',
                        },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Error Banner ── */}
          {errorMsg && (
            <Animated.View entering={FadeIn.duration(200)} style={s.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={s.errorBannerText}>{errorMsg}</Text>
            </Animated.View>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 1: AUTOMATIC HARDWARE DETECTION                            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <View style={s.stepWrapper}>
              <View style={s.stepHeadingBlock}>
                <Text style={[s.stepTitle, { color: colors.text }]}>
                  {isConnected
                    ? 'Hardware Detected'
                    : 'Detecting Hardware'}
                </Text>
              </View>

              <ScrollView
                style={s.stepScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.detectContent}
              >
                {isConnected ? (
                  /* ── HARDWARE AUTO-DETECTED FROSTED GLASS HERO CARD ── */
                  <View style={{ width: '100%', gap: 12 }}>
                    <View
                      style={[
                        s.detectedHeroCard,
                        {
                          backgroundColor: isDark
                            ? 'rgba(6, 214, 160, 0.08)'
                            : 'rgba(6, 214, 160, 0.06)',
                          borderColor: isDark ? 'rgba(6, 214, 160, 0.45)' : 'rgba(6, 214, 160, 0.55)',
                        },
                      ]}
                    >
                      <View style={s.detectedTopRow}>
                        <View
                          style={[
                            s.detectedIconBox,
                            {
                              backgroundColor: `${selectedModel.badgeColor}28`,
                              borderColor: selectedModel.badgeColor,
                            },
                          ]}
                        >
                          <Ionicons
                            name="hardware-chip"
                            size={28}
                            color={selectedModel.badgeColor}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.detectedBadgePill}>
                            <Ionicons name="sparkles" size={12} color="#06D6A0" />
                            <Text style={s.detectedBadgePillText}>AUTO-DETECTED</Text>
                          </View>
                          <Text style={[s.detectedModelTitle, { color: colors.text }]}>
                            {selectedModel.name}
                          </Text>
                          <Text style={[s.detectedModelTag, { color: colors.dim }]}>
                            {selectedModel.desc}
                          </Text>
                        </View>
                      </View>

                      {/* Frosted Glass Specs Row */}
                      <View
                        style={[
                          s.detectedSpecsRow,
                          {
                            backgroundColor: isDark
                              ? 'rgba(0, 0, 0, 0.35)'
                              : 'rgba(255, 255, 255, 0.75)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.06)',
                          },
                        ]}
                      >
                        <View style={s.specCol}>
                          <Text style={[s.specColKey, { color: colors.dim }]}>Relays</Text>
                          <Text style={[s.specColVal, { color: selectedModel.badgeColor }]}>
                            {selectedModel.channels} Switches
                          </Text>
                        </View>
                        <View
                          style={[
                            s.specColDivider,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        />
                        <View style={s.specCol}>
                          <Text style={[s.specColKey, { color: colors.dim }]}>Bluetooth</Text>
                          <Text style={[s.specColVal, { color: '#06D6A0' }]}>Linked ✓</Text>
                        </View>
                        <View
                          style={[
                            s.specColDivider,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        />
                        <View style={s.specCol}>
                          <Text style={[s.specColKey, { color: colors.dim }]}>Device</Text>
                          <Text
                            style={[s.specColVal, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {h.bleDeviceName || 'Lumo-ESP32'}
                          </Text>
                        </View>
                      </View>


                    </View>

                    {/* Collapsible Manual Override Link */}
                    <Press
                      onPress={() => setShowManualOverride(!showManualOverride)}
                      style={s.manualOverrideToggle}
                    >
                      <Ionicons
                        name={showManualOverride ? 'chevron-up' : 'options-outline'}
                        size={14}
                        color={colors.dim}
                      />
                      <Text style={[s.manualOverrideToggleText, { color: colors.dim }]}>
                        {showManualOverride ? 'Hide manual selection' : 'Manual Override'}
                      </Text>
                    </Press>

                    {showManualOverride && (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        <Text style={[s.manualListTitle, { color: colors.dim }]}>
                          Select Model:
                        </Text>
                        {DEVICE_MODELS.map((model) => {
                          const isSel = selectedModel.id === model.id;
                          return (
                            <Press
                              key={model.id}
                              onPress={() => {
                                tap();
                                setSelectedModel(model);
                              }}
                              style={[
                                s.manualModelCard,
                                {
                                  backgroundColor: isSel
                                    ? isDark
                                      ? 'rgba(0, 132, 255, 0.16)'
                                      : 'rgba(0, 132, 255, 0.08)'
                                    : isDark
                                    ? 'rgba(255, 255, 255, 0.04)'
                                    : 'rgba(255, 255, 255, 0.6)',
                                  borderColor: isSel
                                    ? model.badgeColor
                                    : isDark
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                  borderWidth: isSel ? 1.8 : 1,
                                },
                              ]}
                            >
                              <Text style={[s.manualModelName, { color: colors.text }]}>
                                {model.name}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {isConnected && hwChannels !== null && model.channels > hwChannels && (
                                  <View
                                    style={[
                                      s.manualModelPill,
                                      { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                                    ]}
                                  >
                                    <Text style={[s.manualModelPillText, { color: '#EF4444' }]}>
                                      Exceeds Board ({hwChannels} CH)
                                    </Text>
                                  </View>
                                )}
                                <View
                                  style={[
                                    s.manualModelPill,
                                    { backgroundColor: `${model.badgeColor}25` },
                                  ]}
                                >
                                  <Text
                                    style={[s.manualModelPillText, { color: model.badgeColor }]}
                                  >
                                    {model.channels} CH
                                  </Text>
                                </View>
                              </View>
                            </Press>
                          );
                        })}

                        {hasHardwareMismatch && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              padding: 10,
                              borderRadius: 12,
                              backgroundColor: isDark
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(245, 158, 11, 0.08)',
                              borderWidth: 1,
                              borderColor: 'rgba(245, 158, 11, 0.35)',
                              marginTop: 4,
                            }}
                          >
                            <Ionicons name="warning" size={16} color="#F59E0B" />
                            <Text
                              style={{
                                flex: 1,
                                fontSize: 11.5,
                                color: isDark ? '#FCD34D' : '#D97706',
                              }}
                            >
                              Board has only {hwChannels} relays. Selecting {selectedModel.channels} CH will cause switches {hwChannels + 1} to {selectedModel.channels} to show as unavailable.
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  /* ── SCANNING & CONNECTING VIEW ── */
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <View style={s.radarWrapper}>
                      <Animated.View style={[s.radarPulseRing, ring1]} />
                      <Animated.View style={[s.radarPulseRing, ring2]} />
                      <View
                        style={[
                          s.radarCenterOrb,
                          {
                            backgroundColor: 'rgba(0, 132, 255, 0.16)',
                            borderColor: '#0084FF',
                          },
                        ]}
                      >
                        <Ionicons name="bluetooth" size={32} color="#0084FF" />
                      </View>
                    </View>

                    {isScanning && (
                      <View style={s.scanningStatusRow}>
                        <ActivityIndicator size="small" color="#0084FF" />
                        <Text style={[s.scanningStatusText, { color: colors.dim }]}>
                          Scanning for nearby Lumo relay boards…
                        </Text>
                      </View>
                    )}

                    {discoveredDevices.length > 0 ? (
                      <View style={{ width: '100%', gap: 8, marginTop: 10 }}>
                        <Text style={[s.discoveredLabel, { color: colors.dim }]}>
                          Discovered Lumo Controllers:
                        </Text>
                        {discoveredDevices.map((dev) => (
                          <Press
                            key={dev.id}
                            onPress={() => handleSelectDevice(dev)}
                            style={[
                              s.deviceSelectCard,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255, 255, 255, 0.05)'
                                  : 'rgba(255, 255, 255, 0.75)',
                                borderColor: isDark
                                  ? 'rgba(255, 255, 255, 0.12)'
                                  : 'rgba(0, 0, 0, 0.08)',
                              },
                            ]}
                          >
                            <Ionicons name="bluetooth" size={18} color="#0084FF" />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.deviceNameText, { color: colors.text }]}>
                                {dev.name}
                              </Text>
                              <Text style={[s.deviceTapHint, { color: colors.dim }]}>
                                Tap to connect & auto-detect
                              </Text>
                            </View>
                            {isConnecting ? (
                              <ActivityIndicator size="small" color="#0084FF" />
                            ) : (
                              <Ionicons name="chevron-forward" size={16} color={colors.dim} />
                            )}
                          </Press>
                        ))}
                      </View>
                    ) : (
                      <Press
                        onPress={startScan}
                        disabled={isScanning || isConnecting}
                        style={[
                          s.scanTriggerBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(0, 132, 255, 0.1)'
                              : 'rgba(0, 132, 255, 0.08)',
                            borderColor: '#0084FF',
                          },
                        ]}
                      >
                        <Ionicons name="search" size={16} color="#0084FF" />
                        <Text style={[s.scanTriggerBtnText, { color: '#0084FF' }]}>
                          {isScanning ? 'Searching Controllers…' : 'Scan for Hardware Board'}
                        </Text>
                      </Press>
                    )}

                    {/* Manual Override Fallback Button */}
                    <Press
                      onPress={() => setShowManualOverride(!showManualOverride)}
                      style={[s.manualOverrideToggle, { marginTop: 16 }]}
                    >
                      <Ionicons name="options-outline" size={14} color={colors.dim} />
                      <Text style={[s.manualOverrideToggleText, { color: colors.dim }]}>
                        {showManualOverride
                          ? 'Hide manual options'
                          : 'Testing without physical hardware? Select manually'}
                      </Text>
                    </Press>

                    {showManualOverride && (
                      <View style={{ width: '100%', gap: 8, marginTop: 8 }}>
                        {DEVICE_MODELS.map((model) => {
                          const isSel = selectedModel.id === model.id;
                          return (
                            <Press
                              key={model.id}
                              onPress={() => {
                                tap();
                                setSelectedModel(model);
                              }}
                              style={[
                                s.manualModelCard,
                                {
                                  backgroundColor: isSel
                                    ? isDark
                                      ? 'rgba(0, 132, 255, 0.16)'
                                      : 'rgba(0, 132, 255, 0.08)'
                                    : isDark
                                    ? 'rgba(255, 255, 255, 0.04)'
                                    : 'rgba(255, 255, 255, 0.6)',
                                  borderColor: isSel
                                    ? model.badgeColor
                                    : isDark
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                  borderWidth: isSel ? 1.8 : 1,
                                },
                              ]}
                            >
                              <Text style={[s.manualModelName, { color: colors.text }]}>
                                {model.name}
                              </Text>
                              <View
                                style={[
                                  s.manualModelPill,
                                  { backgroundColor: `${model.badgeColor}25` },
                                ]}
                              >
                                <Text
                                  style={[s.manualModelPillText, { color: model.badgeColor }]}
                                >
                                  {model.channels} CH
                                </Text>
                              </View>
                            </Press>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* Bottom Docked Action Bar */}
              <View
                style={[
                  s.footerBar,
                  { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                ]}
              >
                <Press
                  onPress={() => {
                    tap();
                    setStep(2);
                  }}
                  style={s.liquidPrimaryActionBtn}
                >
                  <Text style={s.liquidPrimaryActionBtnText}>
                    Test All {selectedModel.channels} Relays On Board
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color="#FFF" />
                </Press>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 2: TEST HARDWARE RELAYS (Modern Liquid Glass Rows)          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <View style={s.stepWrapper}>
              <View style={s.stepHeadingBlock}>
                <View style={s.testHeaderRow}>
                  <Text style={[s.stepTitle, { color: colors.text }]}>
                    {hasHardwareMismatch
                      ? `Testing Board (${hwChannels} CH Relays)`
                      : `Test All ${selectedModel.channels} Relays`}
                  </Text>
                  <View
                    style={[
                      s.verifiedCountBadge,
                      {
                        backgroundColor:
                          verifiedCount === targetTestCount
                            ? 'rgba(6, 214, 160, 0.18)'
                            : 'rgba(0, 132, 255, 0.15)',
                        borderColor:
                          verifiedCount === targetTestCount
                            ? '#06D6A0'
                            : '#0084FF',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        verifiedCount === targetTestCount
                          ? 'checkmark-circle'
                          : 'radio-button-on'
                      }
                      size={13}
                      color={
                        verifiedCount === targetTestCount ? '#06D6A0' : '#0084FF'
                      }
                    />
                    <Text
                      style={[
                        s.verifiedCountBadgeText,
                        {
                          color:
                            verifiedCount === targetTestCount
                              ? '#06D6A0'
                              : '#0084FF',
                        },
                      ]}
                    >
                      {verifiedCount}/{targetTestCount} Physical Tested
                    </Text>
                  </View>
                </View>

                {/* ── Hardware Mismatch Warning Banner in Step 2 ── */}
                {hasHardwareMismatch && (
                  <View
                    style={[
                      s.mismatchStepCard,
                      {
                        backgroundColor: isDark
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(245, 158, 11, 0.08)',
                        borderColor: 'rgba(245, 158, 11, 0.45)',
                      },
                    ]}
                  >
                    <View style={s.mismatchStepCardHeader}>
                      <Ionicons name="warning" size={18} color="#F59E0B" />
                      <Text style={s.mismatchStepCardTitle}>Hardware Board Mismatch</Text>
                    </View>
                    <Text style={[s.mismatchStepCardDesc, { color: colors.dim }]}>
                      Your connected ESP32 board physically has only {hwChannels} relays. {selectedModel.name} ({selectedModel.channels} CH) is selected, so switches {hwChannels + 1} to {selectedModel.channels} do not exist on the board and will not respond.
                    </Text>
                    <Press
                      onPress={() => {
                        tap();
                        const detected = DEVICE_MODELS.find((m) => m.channels === hwChannels);
                        if (detected) {
                          setSelectedModel(detected);
                          setVerifiedSwitches({});
                          setChannelErrors({});
                        }
                      }}
                      style={s.fixToDetectedBtn}
                    >
                      <Ionicons name="sparkles" size={14} color="#06D6A0" />
                      <Text style={s.fixToDetectedBtnText}>
                        Fix: Switch to LUMO R{hwChannels} ({hwChannels} CH)
                      </Text>
                    </Press>
                  </View>
                )}



                {/* Quick Liquid Glass All On / All Off Bar */}
                <View style={s.quickActionBar}>
                  <Press
                    onPress={() => handleTestAll(true)}
                    style={[
                      s.quickActionBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 159, 28, 0.14)'
                          : 'rgba(255, 159, 28, 0.1)',
                        borderColor: 'rgba(255, 159, 28, 0.45)',
                      },
                    ]}
                  >
                    <Ionicons name="sunny" size={13} color="#FF9F1C" />
                    <Text style={[s.quickActionBtnText, { color: isDark ? '#FFB247' : '#EA580C' }]}>
                      Turn All ON
                    </Text>
                  </Press>

                  <Press
                    onPress={() => handleTestAll(false)}
                    style={[
                      s.quickActionBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.14)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  >
                    <Ionicons name="power" size={13} color={colors.dim} />
                    <Text style={[s.quickActionBtnText, { color: colors.dim }]}>
                      Turn All OFF
                    </Text>
                  </Press>
                </View>
              </View>

              <ScrollView
                style={s.stepScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.switchListContent}
              >
                {modelChannels.map((ch) => {
                  const isOn = !!h.on[ch.id];
                  const isMissingHardware = isConnected && hwChannels !== null && ch.id > hwChannels;
                  const isVerifying = verifyingChannelId === ch.id;
                  const isVerified = !isMissingHardware && !!verifiedSwitches[ch.id];
                  const channelError = channelErrors[ch.id];

                  return (
                    <Press
                      key={ch.id}
                      onPress={() => handleTestToggle(ch.id)}
                      style={[
                        s.liquidGlassRowCard,
                        {
                          backgroundColor: isMissingHardware
                            ? isDark
                              ? 'rgba(239, 68, 68, 0.06)'
                              : 'rgba(239, 68, 68, 0.04)'
                            : isOn
                            ? isDark
                              ? `${ch.color}20`
                              : `${ch.color}15`
                            : isDark
                            ? 'rgba(255, 255, 255, 0.045)'
                            : 'rgba(255, 255, 255, 0.72)',
                          borderColor: isMissingHardware
                            ? 'rgba(239, 68, 68, 0.35)'
                            : isOn
                            ? ch.color
                            : isDark
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.08)',
                          shadowColor: isMissingHardware
                            ? '#EF4444'
                            : isOn
                            ? ch.color
                            : '#000',
                          shadowOpacity: isMissingHardware ? 0.15 : isOn ? 0.35 : isDark ? 0.2 : 0.05,
                          shadowRadius: isOn ? 14 : 8,
                          elevation: isOn ? 6 : 2,
                          opacity: isMissingHardware ? 0.78 : 1,
                        },
                      ]}
                    >
                      {/* Top Specular Sheen on each card */}
                      <View
                        style={[
                          s.cardSpecularLine,
                          {
                            backgroundColor: isMissingHardware
                              ? 'rgba(239, 68, 68, 0.25)'
                              : isOn
                              ? 'rgba(255, 255, 255, 0.45)'
                              : isDark
                              ? 'rgba(255, 255, 255, 0.15)'
                              : 'rgba(255, 255, 255, 0.8)',
                          },
                        ]}
                      />

                      {/* Left: Glowing Channel Icon */}
                      <View
                        style={[
                          s.switchRowIconBox,
                          {
                            backgroundColor: isMissingHardware
                              ? 'rgba(239, 68, 68, 0.12)'
                              : isOn
                              ? ch.color
                              : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                            borderColor: isMissingHardware
                              ? 'rgba(239, 68, 68, 0.3)'
                              : isOn
                              ? 'rgba(255, 255, 255, 0.4)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <Ionicons
                          name={isMissingHardware ? 'ban-outline' : (ch.icon as any)}
                          size={22}
                          color={isMissingHardware ? '#EF4444' : isOn ? '#FFF' : colors.dim}
                        />
                      </View>

                      {/* Middle: Details with No Truncation */}
                      <View style={s.switchRowInfoCol}>
                        <View style={s.switchRowTitleRow}>
                          <Text
                            style={[
                              s.switchRowTitleText,
                              {
                                color: isMissingHardware ? colors.dim : colors.text,
                                fontWeight: '700',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {h.names[ch.id] || ch.name}
                          </Text>

                          {isMissingHardware ? (
                            <View style={s.missingRowBadge}>
                              <Ionicons name="close-circle" size={11} color="#EF4444" />
                              <Text style={s.missingRowBadgeText}>No Relay on Board</Text>
                            </View>
                          ) : isVerifying ? (
                            <View style={s.verifyingRowBadge}>
                              <ActivityIndicator size="small" color="#0084FF" />
                              <Text style={s.verifyingRowBadgeText}>Clicking…</Text>
                            </View>
                          ) : isVerified ? (
                            <View style={s.verifiedRowBadge}>
                              <Ionicons name="checkmark-circle" size={12} color="#06D6A0" />
                              <Text style={s.verifiedRowBadgeText}>Tested ✓</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={[s.switchRowSubText, { color: colors.dim }]}>
                          {isMissingHardware
                            ? 'Unavailable'
                            : (h.rooms[ch.id] || ch.room)}
                        </Text>

                        {channelError && (
                          <Text style={s.channelErrorRowText}>
                            ⚠️ {channelError}
                          </Text>
                        )}
                      </View>

                      {/* Right: Modern Liquid Glass Power Pill */}
                      {isMissingHardware ? (
                        <View style={s.missingTogglePill}>
                          <Ionicons name="ban" size={13} color="#EF4444" />
                          <Text style={s.missingTogglePillText}>N/A</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            s.switchRowTogglePill,
                            {
                              backgroundColor: isOn
                                ? ch.color
                                : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.06)',
                              borderColor: isOn
                                ? 'rgba(255, 255, 255, 0.35)'
                                : isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.08)',
                              shadowColor: isOn ? ch.color : 'transparent',
                              shadowOpacity: isOn ? 0.4 : 0,
                              shadowRadius: 8,
                            },
                          ]}
                        >
                          <Ionicons
                            name="power"
                            size={14}
                            color={isOn ? '#FFF' : colors.dim}
                          />
                          <Text
                            style={[
                              s.switchRowTogglePillText,
                              { color: isOn ? '#FFF' : colors.dim },
                            ]}
                          >
                            {isOn ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      )}
                    </Press>
                  );
                })}
              </ScrollView>

              {/* Bottom Docked Action Bar */}
              <View
                style={[
                  s.footerBar,
                  { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                ]}
              >
                <View style={s.footerBtnRow}>
                  <Press
                    onPress={() => setStep(1)}
                    style={[
                      s.footerBackBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  >
                    <Ionicons name="arrow-back" size={16} color={colors.dim} />
                    <Text style={[s.footerBackBtnText, { color: colors.dim }]}>Back</Text>
                  </Press>

                  <Press
                    onPress={handleFinishSetup}
                    disabled={hasHardwareMismatch || verifiedCount < targetTestCount}
                    style={[
                      s.liquidPrimaryActionBtn,
                      {
                        flex: 1,
                        opacity: hasHardwareMismatch || verifiedCount < targetTestCount ? 0.65 : 1,
                        backgroundColor: hasHardwareMismatch
                          ? '#EF4444'
                          : verifiedCount === targetTestCount
                          ? '#06D6A0'
                          : '#0084FF',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        hasHardwareMismatch
                          ? 'alert-circle'
                          : verifiedCount === targetTestCount
                          ? 'checkmark-done'
                          : 'time-outline'
                      }
                      size={18}
                      color="#FFF"
                    />
                    <Text style={s.liquidPrimaryActionBtnText}>
                      {hasHardwareMismatch
                        ? `Mismatch: Board has only ${hwChannels} CH`
                        : verifiedCount === targetTestCount
                        ? 'Complete Setup'
                        : `Test All ${targetTestCount} Relays First`}
                    </Text>
                  </Press>
                </View>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 3: SETUP COMPLETE                                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <View style={s.stepWrapper}>
              <ScrollView
                style={s.stepScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.celebrateContent}
              >
                <View style={s.celebrationBadge}>
                  <Ionicons name="checkmark" size={38} color="#FFF" />
                </View>

                <Text style={[s.celebrateTitle, { color: colors.text }]}>
                  Setup Complete!
                </Text>


                {/* Frosted Glass Hardware Spec Summary */}
                <View
                  style={[
                    s.specCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.045)'
                        : 'rgba(255, 255, 255, 0.75)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <View style={s.specRow}>
                    <Text style={[s.specKey, { color: colors.dim }]}>Detected Hardware:</Text>
                    <Text
                      style={[
                        s.specVal,
                        { color: selectedModel.badgeColor, fontWeight: '700' },
                      ]}
                    >
                      {selectedModel.name} ({selectedModel.tag})
                    </Text>
                  </View>
                  <View
                    style={[
                      s.specDivider,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  />
                  <View style={s.specRow}>
                    <Text style={[s.specKey, { color: colors.dim }]}>Active Switches:</Text>
                    <Text style={[s.specVal, { color: colors.text }]}>
                      {selectedModel.channels} Relays Activated
                    </Text>
                  </View>
                  <View
                    style={[
                      s.specDivider,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  />
                  <View style={s.specRow}>
                    <Text style={[s.specKey, { color: colors.dim }]}>Bluetooth Link:</Text>
                    <Text style={[s.specVal, { color: '#06D6A0' }]}>
                      {isConnected ? 'Connected ✓' : 'Paired'}
                    </Text>
                  </View>
                </View>

                {onOpenWifi && (
                  <Press
                    onPress={() => {
                      tap();
                      onClose();
                      setTimeout(onOpenWifi, 250);
                    }}
                    style={[
                      s.wifiSetupOptionBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(0, 132, 255, 0.12)'
                          : 'rgba(0, 132, 255, 0.08)',
                        borderColor: '#0084FF',
                      },
                    ]}
                  >
                    <Ionicons name="wifi" size={16} color="#0084FF" />
                    <Text style={[s.wifiSetupOptionBtnText, { color: '#0084FF' }]}>
                      Configure Controller Wi-Fi (Router)
                    </Text>
                  </Press>
                )}
              </ScrollView>

              <View
                style={[
                  s.footerBar,
                  { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                ]}
              >
                <Press
                  onPress={() => {
                    tap();
                    onClose();
                  }}
                  style={s.liquidPrimaryActionBtn}
                >
                  <Text style={s.liquidPrimaryActionBtnText}>
                    Open Dashboard ({selectedModel.channels} Switches)
                  </Text>
                  <Ionicons name="home" size={16} color="#FFF" />
                </Press>
              </View>
            </View>
          )}
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
    maxWidth: 520,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    paddingHorizontal: 20,
    paddingTop: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 28,
    elevation: 24,
    flexDirection: 'column',
  },

  /* Liquid Ambient Floating Glow Orbs */
  liquidOrbA: {
    position: 'absolute',
    top: -80,
    right: -80,
  },
  liquidOrbB: {
    position: 'absolute',
    bottom: -60,
    left: -70,
  },
  liquidOrbC: {
    position: 'absolute',
    top: '40%',
    left: '30%',
  },

  /* Top Specular Line */
  specularGlassLine: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1.2,
    borderRadius: 1,
  },

  handle: {
    width: 40,
    height: 4.5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerModelPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerModelPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  /* Liquid Segmented Stepper Bar */
  stepperGlassBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 10,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepItemLabel: {
    fontSize: 10.5,
  },
  stepConnectorLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 14,
    borderRadius: 1,
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  /* Step Container Wrapper */
  stepWrapper: {
    flexShrink: 1,
    width: '100%',
  },
  stepHeadingBlock: {
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  stepScrollView: {
    maxHeight: 380,
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },

  /* Step 1: Detect Content */
  detectContent: {
    paddingVertical: 4,
    width: '100%',
  },
  detectedHeroCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  detectedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detectedIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  detectedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 214, 160, 0.18)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginBottom: 3,
  },
  detectedBadgePillText: {
    color: '#06D6A0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detectedModelTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  detectedModelTag: {
    fontSize: 11.5,
    marginTop: 1,
  },
  detectedSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  specCol: {
    alignItems: 'center',
    flex: 1,
  },
  specColKey: {
    fontSize: 10.5,
    marginBottom: 2,
  },
  specColVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  specColDivider: {
    width: 1,
    height: 24,
  },
  detectedVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detectedVerifiedText: {
    fontSize: 11.5,
    flex: 1,
  },
  manualOverrideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  manualOverrideToggleText: {
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  manualListTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  manualModelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
  },
  manualModelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualModelPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  manualModelPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  /* Radar visual */
  radarWrapper: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  radarPulseRing: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderColor: '#0084FF',
  },
  radarCenterOrb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  scanningStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  scanningStatusText: {
    fontSize: 12,
  },
  discoveredLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  deviceSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  deviceNameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deviceTapHint: {
    fontSize: 11,
  },
  scanTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 6,
  },
  scanTriggerBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Step 2: Test Hardware Relays (Modern Liquid Glass) */
  testHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  verifiedCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  verifiedCountBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  quickActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  quickActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  switchListContent: {
    width: '100%',
    paddingVertical: 6,
    gap: 10,
  },

  /* Liquid Glass Row Card */
  liquidGlassRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 18,
    borderWidth: 1.4,
    overflow: 'hidden',
  },
  cardSpecularLine: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
  },
  switchRowIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  switchRowInfoCol: {
    flex: 1,
    marginHorizontal: 13,
  },
  switchRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchRowTitleText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mismatchStepCard: {
    width: '100%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.2,
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  mismatchStepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mismatchStepCardTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '800',
  },
  mismatchStepCardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  fixToDetectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 214, 160, 0.16)',
    borderWidth: 1,
    borderColor: '#06D6A0',
    alignSelf: 'flex-start',
  },
  fixToDetectedBtnText: {
    color: '#06D6A0',
    fontSize: 12,
    fontWeight: '800',
  },
  verifiedRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 214, 160, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.4)',
  },
  verifiedRowBadgeText: {
    color: '#06D6A0',
    fontSize: 10.5,
    fontWeight: '800',
  },
  missingRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  missingRowBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  verifyingRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 132, 255, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 132, 255, 0.35)',
  },
  verifyingRowBadgeText: {
    color: '#0084FF',
    fontSize: 10,
    fontWeight: '700',
  },
  channelErrorRowText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  switchRowSubText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  switchRowTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1.2,
    minWidth: 70,
    justifyContent: 'center',
  },
  switchRowTogglePillText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  missingTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    minWidth: 70,
    justifyContent: 'center',
  },
  missingTogglePillText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Step 3: Celebration */
  celebrateContent: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  celebrationBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#06D6A0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06D6A0',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 12,
  },
  celebrateTitle: {
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 2,
  },
  celebrateSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  specCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 14,
    gap: 10,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  specKey: {
    fontSize: 12,
  },
  specVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  specDivider: {
    height: 1,
  },
  wifiSetupOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    width: '100%',
    marginTop: 12,
  },
  wifiSetupOptionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Pinned Bottom Footer */
  footerBar: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
    width: '100%',
  },
  footerBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  footerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  footerBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Modern Liquid Primary Action Button */
  liquidPrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.2,
    backgroundColor: '#06D6A0',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#06D6A0',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
  },
  liquidPrimaryActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
