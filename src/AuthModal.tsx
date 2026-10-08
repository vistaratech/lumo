import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Glow, tap, notify } from './theme';
import { useHome } from './useHome';
import { signInWithEmail, signUpWithEmail, continueAsGuest } from './auth';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  canDismiss?: boolean;
}

export default function AuthModal({ visible, onClose, canDismiss = true }: AuthModalProps) {
  const { colors, isDark } = useHome();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setHouseholdName('');
    setErrorMsg(null);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      notify('error');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    tap();
    try {
      const res = await signInWithEmail(email, password);
      if (res.success) {
        notify('success');
        resetForm();
        onClose();
      } else {
        setErrorMsg(res.error || 'Authentication failed');
        notify('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign in');
      notify('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setErrorMsg('Email and password are required');
      notify('error');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    tap();
    try {
      const res = await signUpWithEmail(email, password, displayName, householdName);
      if (res.success) {
        notify('success');
        resetForm();
        onClose();
      } else {
        setErrorMsg(res.error || 'Registration failed');
        notify('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to register');
      notify('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    tap();
    setLoading(true);
    try {
      await continueAsGuest('Home Guest');
      notify('success');
      resetForm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => canDismiss && onClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[s.backdrop, { backgroundColor: isDark ? 'rgba(4, 7, 14, 0.88)' : 'rgba(15, 23, 42, 0.65)' }]}
      >
        <Animated.View
          entering={FadeInUp.duration(320)}
          style={[
            s.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
            },
          ]}
        >
          {/* Ambient Glow */}
          <View pointerEvents="none" style={s.glowWrapper}>
            <Glow id="auth-glow" size={300} color={colors.lamp} opacity={0.22} />
          </View>

          {/* Close button if allowed */}
          {canDismiss && (
            <Pressable
              style={[s.closeBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => {
                tap();
                onClose();
              }}
            >
              <Ionicons name="close" size={20} color={colors.dim} />
            </Pressable>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            {/* Header Badge */}
            <View style={s.header}>
              <View style={[s.iconCircle, { backgroundColor: `${colors.lamp}18`, borderColor: colors.lamp }]}>
                <Ionicons name="shield-checkmark-outline" size={26} color={colors.lamp} />
              </View>
              <Text style={[s.title, { color: colors.text }]}>Lumo Account</Text>
              <Text style={[s.subtitle, { color: colors.dim }]}>
                Secure your home switches with an encrypted private household account.
              </Text>
            </View>

            {/* Tab Switcher */}
            <View style={[s.tabsWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Pressable
                style={[s.tabBtn, tab === 'signin' && [s.tabBtnActive, { backgroundColor: colors.card }]]}
                onPress={() => {
                  tap();
                  setTab('signin');
                  setErrorMsg(null);
                }}
              >
                <Text
                  style={[
                    s.tabLabel,
                    { color: tab === 'signin' ? colors.lamp : colors.dim },
                    tab === 'signin' && { fontWeight: '600' },
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>

              <Pressable
                style={[s.tabBtn, tab === 'signup' && [s.tabBtnActive, { backgroundColor: colors.card }]]}
                onPress={() => {
                  tap();
                  setTab('signup');
                  setErrorMsg(null);
                }}
              >
                <Text
                  style={[
                    s.tabLabel,
                    { color: tab === 'signup' ? colors.lamp : colors.dim },
                    tab === 'signup' && { fontWeight: '600' },
                  ]}
                >
                  New Household
                </Text>
              </Pressable>
            </View>

            {/* Error Message */}
            {errorMsg && (
              <Animated.View entering={FadeInDown.duration(200)} style={[s.errBox, { backgroundColor: `${colors.bad}15`, borderColor: colors.bad }]}>
                <Ionicons name="alert-circle" size={16} color={colors.bad} />
                <Text style={[s.errText, { color: colors.bad }]}>{errorMsg}</Text>
              </Animated.View>
            )}

            {/* Form Fields */}
            <View style={s.form}>
              {tab === 'signup' && (
                <>
                  <View style={s.inputGroup}>
                    <Text style={[s.label, { color: colors.dim }]}>YOUR NAME</Text>
                    <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                      <Ionicons name="person-outline" size={18} color={colors.dim} style={s.fieldIcon} />
                      <TextInput
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="e.g. Yogesh"
                        placeholderTextColor={colors.dimmer}
                        style={[s.input, { color: colors.text }]}
                      />
                    </View>
                  </View>

                  <View style={s.inputGroup}>
                    <Text style={[s.label, { color: colors.dim }]}>HOUSEHOLD / VILLA NAME</Text>
                    <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                      <Ionicons name="home-outline" size={18} color={colors.dim} style={s.fieldIcon} />
                      <TextInput
                        value={householdName}
                        onChangeText={setHouseholdName}
                        placeholder="e.g. Green Villa, Flat 402"
                        placeholderTextColor={colors.dimmer}
                        style={[s.input, { color: colors.text }]}
                      />
                    </View>
                  </View>
                </>
              )}

              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.dim }]}>EMAIL ADDRESS</Text>
                <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.dim} style={s.fieldIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="customer@domain.com"
                    placeholderTextColor={colors.dimmer}
                    style={[s.input, { color: colors.text }]}
                  />
                </View>
              </View>

              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.dim }]}>PASSWORD</Text>
                <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.dim} style={s.fieldIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.dimmer}
                    style={[s.input, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                disabled={loading}
                style={[s.submitBtn, { backgroundColor: colors.lamp }, loading && { opacity: 0.6 }]}
                onPress={tab === 'signin' ? handleSignIn : handleSignUp}
              >
                <Text style={s.submitBtnText}>
                  {loading ? 'Authenticating…' : tab === 'signin' ? 'Sign In & Connect' : 'Create Home Account'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>

              {/* Guest / Demo Option */}
              <View style={s.guestDivider}>
                <View style={[s.dividerLine, { backgroundColor: colors.line }]} />
                <Text style={[s.dividerText, { color: colors.dimmer }]}>OR QUICK START</Text>
                <View style={[s.dividerLine, { backgroundColor: colors.line }]} />
              </View>

              <Pressable
                style={[s.guestBtn, { backgroundColor: colors.chipBg, borderColor: colors.line }]}
                onPress={handleGuest}
              >
                <Ionicons name="flash-outline" size={16} color={colors.cyan} />
                <Text style={[s.guestBtnText, { color: colors.text }]}>Continue as Offline Guest</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 16,
  },
  glowWrapper: {
    position: 'absolute',
    top: -80,
    right: -80,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scroll: {
    paddingBottom: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  tabsWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  errText: {
    fontSize: 12,
    flex: 1,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    gap: 8,
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  guestDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
