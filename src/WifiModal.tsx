import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, notify, tap } from './theme';
import { ScannedWifi, useHome } from './useHome';

interface WifiModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenBluetooth?: () => void;
}

function SignalIcon({ rssi }: { rssi: number }) {
  if (rssi >= -60) {
    return <Ionicons name="wifi" size={17} color="#06D6A0" />;
  } else if (rssi >= -75) {
    return <Ionicons name="wifi" size={17} color="#38BDF8" />;
  } else {
    return <Ionicons name="wifi-outline" size={17} color="#F59E0B" />;
  }
}

export default function WifiModal({
  visible,
  onClose,
  onOpenBluetooth,
}: WifiModalProps) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 580;

  const [ssid, setSsid] = useState(h.wifiSsid || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);

  // Auto-scan Wi-Fi networks when modal opens with active Bluetooth
  useEffect(() => {
    if (visible && h.bleActive) {
      h.refreshWifi();
      h.scanWifi();
    }
  }, [visible, h.bleActive]);

  useEffect(() => {
    if (h.wifiSsid && !ssid) {
      setSsid(h.wifiSsid);
    }
  }, [h.wifiSsid]);

  const handleSelectNetwork = (net: ScannedWifi) => {
    tap();
    setSsid(net.ssid);
    if (!net.locked) {
      setPassword('');
    }
  };

  const handleSave = async () => {
    if (!ssid.trim()) {
      notify('error');
      return;
    }
    if (!h.bleActive) {
      notify('error');
      return;
    }
    tap();
    setSubmitting(true);
    try {
      await h.configureWifi(ssid.trim(), password);
      notify('success');
      setTimeout(() => setSubmitting(false), 2200);
    } catch {
      setSubmitting(false);
      notify('error');
    }
  };

  const handleForget = async () => {
    tap();
    setSubmitting(true);
    try {
      await h.clearWifi();
      setSsid('');
      setPassword('');
      notify('success');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          s.overlay,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
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
              backgroundColor: isDark ? '#111726' : '#FFFFFF',
              borderColor: isDark ? '#1F2A3F' : '#E2E8F0',
              borderRadius: isDesktop ? 28 : 0,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: height * 0.9,
              width: isDesktop ? 480 : '100%',
            },
          ]}
        >
          {/* Top Sheet Handle (Mobile) */}
          {!isDesktop && <View style={[s.handle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />}

          {/* Clean Header Bar */}
          <View style={[s.header, { borderBottomColor: isDark ? '#1C2638' : '#F1F5F9' }]}>
            <View style={s.headerLeft}>
              <View
                style={[
                  s.wifiIconBadge,
                  {
                    backgroundColor:
                      h.wifiStatus === 'connected'
                        ? '#06D6A018'
                        : h.bleActive
                        ? '#0084FF18'
                        : isDark
                        ? '#1E293B'
                        : '#F1F5F9',
                  },
                ]}
              >
                <Ionicons
                  name="wifi"
                  size={18}
                  color={h.wifiStatus === 'connected' ? '#06D6A0' : h.bleActive ? '#0084FF' : colors.dim}
                />
              </View>
              <View>
                <Text style={[s.title, { color: colors.text }]}>Device Wi-Fi Setup</Text>
                <Text style={[s.sub, { color: colors.dim }]}>
                  {h.bleActive ? 'ESP32 Connected via Bluetooth' : 'Connect ESP32 for Remote Access'}
                </Text>
              </View>
            </View>

            <Press onPress={onClose} style={[s.closeBtn, { backgroundColor: isDark ? '#1A2336' : '#F1F5F9' }]}>
              <Ionicons name="close" size={17} color={colors.dim} />
            </Press>
          </View>

          {/* ─────────────────────────────────────────────────────────── */}
          {/* PHASE 1: BLUETOOTH NOT CONNECTED (Clean, Focused Hero Step) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {!h.bleActive ? (
            <View style={s.unpairedContainer}>
              <View
                style={[
                  s.bluetoothHeroBox,
                  {
                    backgroundColor: isDark ? '#162032' : '#F8FAFC',
                    borderColor: isDark ? '#23324A' : '#E2E8F0',
                  },
                ]}
              >
                <View style={s.bluetoothIconRing}>
                  <View style={s.bluetoothIconCore}>
                    <Ionicons name="bluetooth" size={28} color="#0084FF" />
                  </View>
                </View>

                <Text style={[s.heroTitle, { color: colors.text }]}>
                  Bluetooth Link Required
                </Text>
                <Text style={[s.heroSubtitle, { color: colors.dim }]}>
                  To detect nearby 2.4 GHz Wi-Fi and configure your ESP32 router credentials, connect via Bluetooth first.
                </Text>

                {/* Value Checklist */}
                <View style={s.featureList}>
                  <View style={s.featureRow}>
                    <Ionicons name="flash" size={14} color="#06D6A0" />
                    <Text style={[s.featureText, { color: colors.text }]}>
                      Fast Auto-Scan for 2.4 GHz Networks
                    </Text>
                  </View>
                  <View style={s.featureRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#0084FF" />
                    <Text style={[s.featureText, { color: colors.text }]}>
                      Encrypted Password Stored in ESP32 Flash
                    </Text>
                  </View>
                  <View style={s.featureRow}>
                    <Ionicons name="globe" size={14} color="#8B5CF6" />
                    <Text style={[s.featureText, { color: colors.text }]}>
                      Worldwide Control from Mobile SIM (4G/5G)
                    </Text>
                  </View>
                </View>

                {/* Primary Action Button */}
                <Press
                  onPress={() => {
                    tap();
                    onClose();
                    if (onOpenBluetooth) {
                      setTimeout(onOpenBluetooth, 220);
                    }
                  }}
                  style={s.connectBleBtn}
                >
                  <Ionicons name="bluetooth" size={18} color="#FFFFFF" />
                  <Text style={s.connectBleBtnText}>Connect Bluetooth Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </Press>
              </View>

              <Press onPress={onClose} style={s.cancelLink}>
                <Text style={[s.cancelLinkText, { color: colors.dim }]}>Cancel</Text>
              </Press>
            </View>
          ) : (
            /* ───────────────────────────────────────────────────────── */
            /* PHASE 2: BLUETOOTH CONNECTED (Neat, Interactive Scanner)  */
            /* ───────────────────────────────────────────────────────── */
            <ScrollView
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Hardware Live Wi-Fi Status Bar */}
              <View
                style={[
                  s.statusBanner,
                  h.wifiStatus === 'connected'
                    ? {
                        backgroundColor: isDark ? '#06D6A012' : '#ECFDF5',
                        borderColor: isDark ? '#06D6A035' : '#A7F3D0',
                      }
                    : h.wifiStatus === 'connecting'
                    ? {
                        backgroundColor: isDark ? '#F59E0B12' : '#FEF3C7',
                        borderColor: isDark ? '#F59E0B35' : '#FDE68A',
                      }
                    : {
                        backgroundColor: isDark ? '#162032' : '#F8FAFC',
                        borderColor: isDark ? '#23324A' : '#E2E8F0',
                      },
                ]}
              >
                <View style={s.statusBannerLeft}>
                  <View
                    style={[
                      s.statusDot,
                      {
                        backgroundColor:
                          h.wifiStatus === 'connected'
                            ? '#06D6A0'
                            : h.wifiStatus === 'connecting'
                            ? '#F59E0B'
                            : '#94A3B8',
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.statusBannerTitle,
                        {
                          color:
                            h.wifiStatus === 'connected'
                              ? '#06D6A0'
                              : h.wifiStatus === 'connecting'
                              ? '#F59E0B'
                              : colors.text,
                        },
                      ]}
                    >
                      {h.wifiStatus === 'connected'
                        ? `Connected to "${h.wifiSsid || 'Home Wi-Fi'}"`
                        : h.wifiStatus === 'connecting'
                        ? 'Connecting to Wi-Fi Router…'
                        : 'Wi-Fi Not Connected'}
                    </Text>
                    <Text style={[s.statusBannerSub, { color: colors.dim }]}>
                      {h.wifiStatus === 'connected'
                        ? `IP: ${h.wifiIp || 'Assigned'} • Remote Cloud Control Active`
                        : h.wifiStatus === 'connecting'
                        ? 'Verifying credentials with ESP32...'
                        : 'Select your home network below to connect'}
                    </Text>
                  </View>
                </View>

                {h.wifiStatus === 'connecting' ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : h.wifiStatus === 'connected' ? (
                  <Press onPress={handleForget} style={s.forgetPill}>
                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    <Text style={s.forgetPillText}>Forget</Text>
                  </Press>
                ) : null}
              </View>

              {/* ── Discovered Nearby Wi-Fi List ── */}
              <View style={s.section}>
                <View style={s.sectionHeaderRow}>
                  <Text style={[s.sectionTitle, { color: colors.dim }]}>
                    AVAILABLE NETWORKS (2.4 GHz)
                  </Text>
                  <Press
                    disabled={h.isScanningWifi}
                    onPress={() => {
                      tap();
                      h.scanWifi();
                    }}
                    style={[
                      s.scanPill,
                      {
                        backgroundColor: isDark ? '#1A2438' : '#EDF2F7',
                        borderColor: isDark ? '#26344E' : '#E2E8F0',
                      },
                    ]}
                  >
                    {h.isScanningWifi ? (
                      <>
                        <ActivityIndicator size="small" color="#0084FF" style={{ transform: [{ scale: 0.65 }] }} />
                        <Text style={[s.scanPillText, { color: '#0084FF' }]}>Scanning…</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={13} color="#0084FF" />
                        <Text style={[s.scanPillText, { color: '#0084FF' }]}>Scan</Text>
                      </>
                    )}
                  </Press>
                </View>

                {/* Loading Banner */}
                {h.isScanningWifi && h.scannedWifiList.length === 0 && (
                  <View style={[s.scanningPlaceholder, { backgroundColor: isDark ? '#141C2B' : '#F8FAFC' }]}>
                    <ActivityIndicator size="small" color="#0084FF" />
                    <Text style={[s.scanningPlaceholderText, { color: colors.dim }]}>
                      ESP32 is scanning nearby 2.4 GHz channels…
                    </Text>
                  </View>
                )}

                {/* List of Available Networks */}
                {h.scannedWifiList.length > 0 ? (
                  <View style={s.wifiList}>
                    {h.scannedWifiList.map((net) => {
                      const isSelected = ssid === net.ssid;
                      return (
                        <Press
                          key={net.ssid}
                          onPress={() => handleSelectNetwork(net)}
                          style={[
                            s.wifiCard,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? '#06D6A015'
                                  : '#ECFDF5'
                                : isDark
                                ? '#141C2B'
                                : '#F8FAFC',
                              borderColor: isSelected
                                ? '#06D6A0'
                                : isDark
                                ? '#1F2A3D'
                                : '#E2E8F0',
                            },
                          ]}
                        >
                          <View style={s.wifiCardLeft}>
                            <SignalIcon rssi={net.rssi} />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  s.wifiCardName,
                                  {
                                    color: isSelected ? '#06D6A0' : colors.text,
                                    fontWeight: isSelected ? '700' : '600',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {net.ssid}
                              </Text>
                              <Text style={[s.wifiCardSub, { color: colors.dim }]}>
                                {net.rssi >= -60 ? 'Strong' : net.rssi >= -75 ? 'Good' : 'Fair'}
                              </Text>
                            </View>
                          </View>

                          <View style={s.wifiCardRight}>
                            {net.locked ? (
                              <Ionicons name="lock-closed" size={13} color={colors.dim} />
                            ) : (
                              <View style={s.openBadge}>
                                <Text style={s.openBadgeText}>OPEN</Text>
                              </View>
                            )}
                            {isSelected ? (
                              <View style={s.checkCircle}>
                                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                              </View>
                            ) : (
                              <View style={[s.radioCircle, { borderColor: isDark ? '#334155' : '#CBD5E1' }]} />
                            )}
                          </View>
                        </Press>
                      );
                    })}
                  </View>
                ) : !h.isScanningWifi ? (
                  <Press
                    onPress={() => {
                      tap();
                      h.scanWifi();
                    }}
                    style={[s.emptyBox, { borderColor: colors.line }]}
                  >
                    <Ionicons name="wifi-outline" size={22} color="#0084FF" />
                    <Text style={[s.emptyBoxText, { color: colors.text }]}>
                      No networks detected yet
                    </Text>
                    <Text style={[s.emptyBoxSub, { color: colors.dim }]}>
                      Tap here to scan nearby 2.4 GHz Wi-Fi routers
                    </Text>
                  </Press>
                ) : null}

                {/* Manual SSID toggle */}
                <Press
                  onPress={() => {
                    tap();
                    setManualEntry(!manualEntry);
                  }}
                  style={s.manualLink}
                >
                  <Ionicons
                    name={manualEntry ? 'chevron-up' : 'chevron-forward'}
                    size={13}
                    color="#0084FF"
                  />
                  <Text style={s.manualLinkText}>
                    {manualEntry ? 'Hide manual name entry' : 'Or enter hidden network name manually'}
                  </Text>
                </Press>
              </View>

              {/* ── Input Card (Shown when a network is chosen or manual entry is active) ── */}
              {(manualEntry || ssid.trim().length > 0) && (
                <Animated.View entering={FadeIn.duration(200)} style={s.credentialCard}>
                  {manualEntry && (
                    <View style={s.fieldGroup}>
                      <Text style={[s.fieldLabel, { color: colors.dim }]}>NETWORK NAME (SSID)</Text>
                      <View
                        style={[
                          s.inputBox,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.line,
                          },
                        ]}
                      >
                        <Ionicons name="wifi-outline" size={16} color={colors.dim} />
                        <TextInput
                          value={ssid}
                          onChangeText={setSsid}
                          placeholder="e.g. Home_Router_2.4G"
                          placeholderTextColor={colors.dim}
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={[s.input, { color: colors.text }]}
                        />
                      </View>
                    </View>
                  )}

                  <View style={s.fieldGroup}>
                    <View style={s.fieldLabelRow}>
                      <Text style={[s.fieldLabel, { color: colors.dim }]}>WI-FI PASSWORD</Text>
                      {ssid.trim().length > 0 && (
                        <Text style={s.fieldBadge} numberOfLines={1}>
                          for {ssid}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        s.inputBox,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.line,
                        },
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={16} color={colors.dim} />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter Wi-Fi password"
                        placeholderTextColor={colors.dim}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[s.input, { color: colors.text }]}
                      />
                      <Press onPress={() => setShowPassword(!showPassword)} style={s.eyeToggle}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={16}
                          color={colors.dim}
                        />
                      </Press>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Minimal Clean Helper Tip */}
              <View style={s.helperBanner}>
                <Ionicons name="information-circle-outline" size={15} color="#0084FF" />
                <Text style={s.helperText}>
                  ESP32 supports 2.4 GHz Wi-Fi. Once paired, you can control switches from anywhere in the world using phone SIM net!
                </Text>
              </View>

              {/* Action Button */}
              <View style={s.buttonContainer}>
                <Press
                  disabled={submitting || !ssid.trim()}
                  onPress={handleSave}
                  style={[
                    s.actionBtn,
                    {
                      backgroundColor: !ssid.trim() ? '#475569' : '#06D6A0',
                      opacity: submitting || !ssid.trim() ? 0.65 : 1,
                    },
                  ]}
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator size="small" color="#0B101B" />
                      <Text style={s.actionBtnText}>Provisioning ESP32…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#0B101B" />
                      <Text style={s.actionBtnText}>
                        {ssid.trim() ? `Connect to "${ssid}"` : 'Select a Network Above'}
                      </Text>
                    </>
                  )}
                </Press>
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.72)',
  },
  dialog: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 28,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wifiIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Phase 1: Unpaired Bluetooth Hero ── */
  unpairedContainer: {
    padding: 22,
    alignItems: 'center',
  },
  bluetoothHeroBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  bluetoothIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0084FF15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bluetoothIconCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0084FF25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  featureList: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
  },
  connectBleBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#0084FF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0084FF',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  connectBleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelLink: {
    marginTop: 16,
    padding: 8,
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Phase 2: Connected Provisioning Scanner ── */
  scrollContent: {
    padding: 18,
    gap: 14,
  },
  statusBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBannerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  forgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF444415',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  forgetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  scanPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scanningPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  scanningPlaceholderText: {
    fontSize: 12,
  },
  wifiList: {
    gap: 6,
    maxHeight: 200,
  },
  wifiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  wifiCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  wifiCardName: {
    fontSize: 13,
  },
  wifiCardSub: {
    fontSize: 10,
  },
  wifiCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openBadge: {
    backgroundColor: '#06D6A018',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  openBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#06D6A0',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#06D6A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  emptyBoxText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyBoxSub: {
    fontSize: 11,
    textAlign: 'center',
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  manualLinkText: {
    fontSize: 11,
    color: '#0084FF',
    fontWeight: '600',
  },
  credentialCard: {
    gap: 10,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  fieldBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#06D6A0',
    maxWidth: 160,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  eyeToggle: {
    padding: 6,
  },
  helperBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#0084FF10',
    padding: 10,
    borderRadius: 12,
  },
  helperText: {
    fontSize: 11,
    color: '#0084FF',
    flex: 1,
    lineHeight: 15,
  },
  buttonContainer: {
    marginTop: 2,
  },
  actionBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B101B',
  },
});
