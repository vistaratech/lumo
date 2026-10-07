import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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
import { useHome } from './useHome';

interface WifiModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function WifiModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;

  const [ssid, setSsid] = useState(h.wifiSsid || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (h.wifiSsid) {
      setSsid(h.wifiSsid);
    }
  }, [h.wifiSsid]);

  useEffect(() => {
    if (visible && h.bleActive) {
      h.refreshWifi();
    }
  }, [visible, h.bleActive]);

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
      setTimeout(() => setSubmitting(false), 2000);
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
      setPassword('');
      notify('success');
    } finally {
      setSubmitting(false);
    }
  };

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
              backgroundColor: isDark ? '#121726' : '#FFFFFF',
              borderColor: isDark ? '#1E273A' : '#E2E8F0',
              borderRadius: isDesktop ? 28 : 0,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: height * 0.88,
              width: isDesktop ? 500 : '100%',
            },
          ]}
        >
          {/* Header Bar */}
          <View style={[s.header, { borderBottomColor: isDark ? '#1F2A3F' : '#E2E8F0' }]}>
            <View style={s.headerLeft}>
              <View style={[s.wifiIconBadge, { backgroundColor: '#06D6A018' }]}>
                <Ionicons name="wifi" size={18} color="#06D6A0" />
              </View>
              <View>
                <Text style={[s.title, { color: colors.text }]}>Device Wi-Fi Setup</Text>
                <Text style={[s.sub, { color: colors.dim }]}>Connect ESP32 for Remote SIM Access</Text>
              </View>
            </View>

            <Press onPress={onClose} style={[s.closeBtn, { backgroundColor: isDark ? '#1B2438' : '#F1F5F9' }]}>
              <Ionicons name="close" size={18} color={colors.dim} />
            </Press>
          </View>

          <View style={s.content}>
            {/* Bluetooth Prerequisite Alert */}
            {!h.bleActive && (
              <Animated.View entering={FadeIn.duration(200)} style={s.warningBanner}>
                <Ionicons name="bluetooth" size={16} color="#0084FF" />
                <Text style={s.warningText}>
                  Connect to ESP32 via Bluetooth first to send Wi-Fi credentials.
                </Text>
              </Animated.View>
            )}

            {/* Current Hardware Wi-Fi Status Card */}
            <View
              style={[
                s.statusCard,
                {
                  backgroundColor: isDark ? '#161D2E' : '#F8FAFC',
                  borderColor: isDark ? '#232E45' : '#E2E8F0',
                },
              ]}
            >
              <View style={s.statusRow}>
                <View style={s.statusLeft}>
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
                  <Text style={[s.statusLabel, { color: colors.text }]}>
                    {h.wifiStatus === 'connected'
                      ? 'Connected to Wi-Fi'
                      : h.wifiStatus === 'connecting'
                      ? 'Connecting to Network…'
                      : 'Not Connected to Wi-Fi'}
                  </Text>
                </View>

                {h.wifiStatus === 'connecting' && <ActivityIndicator size="small" color="#F59E0B" />}
              </View>

              {h.wifiStatus === 'connected' && (
                <View style={s.metaWrap}>
                  {h.wifiSsid ? (
                    <Text style={[s.metaText, { color: colors.dim }]}>
                      Network:{' '}
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{h.wifiSsid}</Text>
                    </Text>
                  ) : null}
                  {h.wifiIp ? (
                    <Text style={[s.metaText, { color: colors.dim }]}>
                      IP Address:{' '}
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{h.wifiIp}</Text>
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            {/* Wi-Fi Form */}
            <View style={s.formGroup}>
              <Text style={[s.inputLabel, { color: colors.dim }]}>WI-FI NETWORK NAME (SSID)</Text>
              <View
                style={[
                  s.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.line,
                  },
                ]}
              >
                <Ionicons name="wifi-outline" size={17} color={colors.dim} />
                <TextInput
                  value={ssid}
                  onChangeText={setSsid}
                  placeholder="e.g. MyHome_WiFi_2.4G"
                  placeholderTextColor={colors.dim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[s.input, { color: colors.text }]}
                />
              </View>
            </View>

            <View style={s.formGroup}>
              <Text style={[s.inputLabel, { color: colors.dim }]}>WI-FI PASSWORD</Text>
              <View
                style={[
                  s.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.line,
                  },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={17} color={colors.dim} />
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
                <Press onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color={colors.dim}
                  />
                </Press>
              </View>
            </View>

            {/* Explanatory Tip */}
            <View style={s.tipRow}>
              <Ionicons name="information-circle-outline" size={15} color="#38BDF8" />
              <Text style={s.tipText}>
                Requires a 2.4 GHz Wi-Fi network. Once configured, your ESP32 stays connected 24/7 so you can control your switches from mobile SIM data anywhere!
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={s.btnRow}>
              <Press
                disabled={submitting || !h.bleActive || !ssid.trim()}
                onPress={handleSave}
                style={[
                  s.submitBtn,
                  {
                    backgroundColor: !h.bleActive || !ssid.trim() ? '#475569' : '#06D6A0',
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#0B101B" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={16} color="#0B101B" />
                    <Text style={s.submitBtnText}>Save & Connect to Wi-Fi</Text>
                  </>
                )}
              </Press>

              {h.wifiStatus === 'connected' && (
                <Press
                  disabled={submitting || !h.bleActive}
                  onPress={handleForget}
                  style={[s.forgetBtn, { borderColor: '#EF444433' }]}
                >
                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                  <Text style={s.forgetBtnText}>Forget Wi-Fi</Text>
                </Press>
              )}
            </View>
          </View>
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
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wifiIconBadge: {
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
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 22,
    gap: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0084FF15',
    borderColor: '#0084FF33',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  warningText: {
    fontSize: 12,
    color: '#38BDF8',
    flex: 1,
    lineHeight: 16,
  },
  statusCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  metaWrap: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
    gap: 2,
  },
  metaText: {
    fontSize: 12,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#0284C712',
    padding: 12,
    borderRadius: 14,
  },
  tipText: {
    fontSize: 12,
    color: '#38BDF8',
    flex: 1,
    lineHeight: 16,
  },
  btnRow: {
    gap: 10,
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B101B',
  },
  forgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#EF444410',
  },
  forgetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
});
