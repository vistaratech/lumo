import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHome } from './useHome';
import { Press, tap, notify } from './theme';

interface VoiceModalProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  { label: 'Veli Light ON', cmd: 'turn on veli light', icon: 'bulb-outline', color: '#FF9500' },
  { label: 'Veli Light OFF', cmd: 'turn off veli light', icon: 'bulb', color: '#94A3B8' },
  { label: 'All ON', cmd: 'turn on all', icon: 'flash', color: '#10B981' },
  { label: 'All OFF', cmd: 'turn off all', icon: 'power', color: '#F43F5E' },
  { label: 'Night Mode', cmd: 'night mode', icon: 'moon-outline', color: '#8B5CF6' },
  { label: 'Reading Mode', cmd: 'reading mode', icon: 'book-outline', color: '#38BDF8' },
];

function AudioWave({ active, color }: { active: boolean; color: string }) {
  const h1 = useSharedValue(12);
  const h2 = useSharedValue(22);
  const h3 = useSharedValue(32);
  const h4 = useSharedValue(18);
  const h5 = useSharedValue(10);

  useEffect(() => {
    if (active) {
      h1.value = withRepeat(withSequence(withTiming(34, { duration: 320 }), withTiming(10, { duration: 320 })), -1, true);
      h2.value = withRepeat(withSequence(withTiming(48, { duration: 270 }), withTiming(14, { duration: 270 })), -1, true);
      h3.value = withRepeat(withSequence(withTiming(60, { duration: 380 }), withTiming(20, { duration: 380 })), -1, true);
      h4.value = withRepeat(withSequence(withTiming(42, { duration: 290 }), withTiming(12, { duration: 290 })), -1, true);
      h5.value = withRepeat(withSequence(withTiming(28, { duration: 340 }), withTiming(8, { duration: 340 })), -1, true);
    } else {
      h1.value = withTiming(12);
      h2.value = withTiming(18);
      h3.value = withTiming(24);
      h4.value = withTiming(16);
      h5.value = withTiming(10);
    }
  }, [active]);

  const s1 = useAnimatedStyle(() => ({ height: h1.value }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value }));
  const s4 = useAnimatedStyle(() => ({ height: h4.value }));
  const s5 = useAnimatedStyle(() => ({ height: h5.value }));

  return (
    <View style={s.waveContainer}>
      <Animated.View style={[s.waveBar, { backgroundColor: color }, s1]} />
      <Animated.View style={[s.waveBar, { backgroundColor: color }, s2]} />
      <Animated.View style={[s.waveBar, { backgroundColor: color }, s3]} />
      <Animated.View style={[s.waveBar, { backgroundColor: color }, s4]} />
      <Animated.View style={[s.waveBar, { backgroundColor: color }, s5]} />
    </View>
  );
}

export default function VoiceModal({ visible, onClose }: VoiceModalProps) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;

  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (visible) {
      setFeedback(null);
      setInput('');
      setIsListening(true);
      const timer = setTimeout(() => setIsListening(false), 2400);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleCommand = (cmdText: string) => {
    tap();
    const res = h.executeVoiceCommand(cmdText);
    setFeedback({ message: res.message, success: res.success });
    if (res.success) {
      notify('success');
    } else {
      notify('error');
    }
    setInput('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(320).easing(Easing.out(Easing.cubic))}
          style={[
            s.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.line,
            },
          ]}
        >
          {/* Header */}
          <View style={s.headerRow}>
            <View>
              <Text style={[s.title, { color: colors.text }]}>Voice Assistant</Text>
            </View>
            <Press onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.surface }]}>
              <Ionicons name="close" size={20} color={colors.dim} />
            </Press>
          </View>

          {/* Voice Wave Animation */}
          <View style={[s.micCircleWrapper, { backgroundColor: `${colors.lamp}12` }]}>
            <AudioWave active={isListening} color={colors.lamp} />
            <Text style={[s.listeningText, { color: colors.lamp }]}>
              {isListening ? 'Listening…' : 'Ready'}
            </Text>
          </View>

          {/* Feedback Banner */}
          {feedback && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[
                s.feedbackBanner,
                {
                  backgroundColor: feedback.success
                    ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7'
                    : isDark ? 'rgba(244, 63, 94, 0.15)' : '#FEE2E2',
                  borderColor: feedback.success ? colors.ok : colors.bad,
                },
              ]}
            >
              <Ionicons
                name={feedback.success ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={feedback.success ? colors.ok : colors.bad}
              />
              <Text
                style={[
                  s.feedbackText,
                  { color: feedback.success ? colors.ok : colors.bad },
                ]}
              >
                {feedback.message}
              </Text>
            </Animated.View>
          )}

          {/* Input Box for custom typing / voice */}
          <View style={[s.inputRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Ionicons name="search-outline" size={18} color={colors.dim} />
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="e.g. veli light on, all off..."
              placeholderTextColor={colors.dimmer}
              style={[s.input, { color: colors.text }]}
              onSubmitEditing={() => input.trim() && handleCommand(input.trim())}
              returnKeyType="send"
            />
            {input.trim().length > 0 && (
              <Press
                onPress={() => handleCommand(input.trim())}
                style={[s.sendBtn, { backgroundColor: colors.lamp }]}
              >
                <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
              </Press>
            )}
          </View>

          {/* Quick Command Chips */}
          <Text style={[s.sectionLabel, { color: colors.dim }]}>QUICK VOICE ACTIONS</Text>
          <View style={s.chipsGrid}>
            {QUICK_COMMANDS.map((item, idx) => (
              <Press
                key={idx}
                onPress={() => handleCommand(item.cmd)}
                style={[
                  s.chip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                <View style={[s.chipIconWrap, { backgroundColor: `${item.color}1E` }]}>
                  <Ionicons name={item.icon as any} size={15} color={item.color} />
                </View>
                <Text style={[s.chipLabel, { color: colors.text }]}>{item.label}</Text>
              </Press>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: -0.8,
  },
  sub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '300',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCircleWrapper: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 64,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
  },
  listeningText: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    fontWeight: '400',
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: -0.3,
  },
});
