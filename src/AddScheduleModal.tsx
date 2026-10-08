import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHome } from './useHome';
import { Press, tap, notify } from './theme';

interface AddScheduleModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddScheduleModal({ visible, onClose }: AddScheduleModalProps) {
  const h = useHome();
  const colors = h.colors;

  const [name, setName] = useState('');
  const [hour, setHour] = useState(18); // 24h
  const [minute, setMinute] = useState(30);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('PM');
  const [targetChannel, setTargetChannel] = useState<number | 'all'>(1);
  const [action, setAction] = useState<'on' | 'off'>('on');
  const [repeat, setRepeat] = useState<'Everyday' | 'Weekdays' | 'Weekends'>('Everyday');

  const formatDisplayHour = () => {
    let h12 = hour % 12;
    if (h12 === 0) h12 = 12;
    return String(h12).padStart(2, '0');
  };

  const handleHourStep = (delta: number) => {
    tap();
    let next = (hour + delta + 24) % 24;
    setHour(next);
    setAmpm(next >= 12 ? 'PM' : 'AM');
  };

  const handleMinuteStep = (delta: number) => {
    tap();
    let next = (minute + delta + 60) % 60;
    setMinute(next);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    tap();
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    await h.addSchedule({
      name: name.trim(),
      enabled: true,
      time: timeString,
      days: [repeat],
      action,
      channelId: targetChannel,
    });
    notify('success');
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
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
              <Text style={[s.title, { color: colors.text }]}>Add Daily Routine</Text>
              <Text style={[s.sub, { color: colors.dim }]}>Automate lights at specific times every day</Text>
            </View>
            <Press onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.surface }]}>
              <Ionicons name="close" size={20} color={colors.dim} />
            </Press>
          </View>

          {/* Routine Name */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>ROUTINE NAME</Text>
          <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Evening Porch Light, Morning Off"
              placeholderTextColor={colors.dimmer}
              style={[s.input, { color: colors.text }]}
            />
          </View>

          {/* Time Picker Stepper */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>SCHEDULE TIME</Text>
          <View style={[s.timePickerCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {/* Hours */}
            <View style={s.timeCol}>
              <Press onPress={() => handleHourStep(1)} style={s.stepperBtn}>
                <Ionicons name="chevron-up" size={18} color={colors.dim} />
              </Press>
              <Text style={[s.timeValue, { color: colors.text }]}>{formatDisplayHour()}</Text>
              <Press onPress={() => handleHourStep(-1)} style={s.stepperBtn}>
                <Ionicons name="chevron-down" size={18} color={colors.dim} />
              </Press>
              <Text style={[s.timeSublabel, { color: colors.dim }]}>HR</Text>
            </View>

            <Text style={[s.timeColon, { color: colors.dim }]}>:</Text>

            {/* Minutes */}
            <View style={s.timeCol}>
              <Press onPress={() => handleMinuteStep(5)} style={s.stepperBtn}>
                <Ionicons name="chevron-up" size={18} color={colors.dim} />
              </Press>
              <Text style={[s.timeValue, { color: colors.text }]}>{String(minute).padStart(2, '0')}</Text>
              <Press onPress={() => handleMinuteStep(-5)} style={s.stepperBtn}>
                <Ionicons name="chevron-down" size={18} color={colors.dim} />
              </Press>
              <Text style={[s.timeSublabel, { color: colors.dim }]}>MIN</Text>
            </View>

            {/* AM / PM */}
            <View style={s.ampmWrap}>
              <Press
                onPress={() => {
                  tap();
                  if (hour >= 12) setHour(hour - 12);
                  setAmpm('AM');
                }}
                style={[s.ampmBtn, ampm === 'AM' && { backgroundColor: colors.lamp }]}
              >
                <Text style={[s.ampmText, { color: ampm === 'AM' ? '#FFFFFF' : colors.dim }]}>AM</Text>
              </Press>
              <Press
                onPress={() => {
                  tap();
                  if (hour < 12) setHour(hour + 12);
                  setAmpm('PM');
                }}
                style={[s.ampmBtn, ampm === 'PM' && { backgroundColor: colors.lamp }]}
              >
                <Text style={[s.ampmText, { color: ampm === 'PM' ? '#FFFFFF' : colors.dim }]}>PM</Text>
              </Press>
            </View>
          </View>

          {/* Action: Turn ON or Turn OFF */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>ACTION</Text>
          <View style={s.rowOptions}>
            <Press
              onPress={() => {
                tap();
                setAction('on');
              }}
              style={[
                s.optionBtn,
                { backgroundColor: action === 'on' ? `${colors.ok}22` : colors.surface, borderColor: action === 'on' ? colors.ok : colors.line },
              ]}
            >
              <Ionicons name="sunny" size={16} color={action === 'on' ? colors.ok : colors.dim} />
              <Text style={[s.optionText, { color: action === 'on' ? colors.ok : colors.dim }]}>Turn ON</Text>
            </Press>

            <Press
              onPress={() => {
                tap();
                setAction('off');
              }}
              style={[
                s.optionBtn,
                { backgroundColor: action === 'off' ? `${colors.bad}22` : colors.surface, borderColor: action === 'off' ? colors.bad : colors.line },
              ]}
            >
              <Ionicons name="power" size={16} color={action === 'off' ? colors.bad : colors.dim} />
              <Text style={[s.optionText, { color: action === 'off' ? colors.bad : colors.dim }]}>Turn OFF</Text>
            </Press>
          </View>

          {/* Target Channel */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>APPLY TO DEVICE</Text>
          <View style={s.rowOptions}>
            <Press
              onPress={() => {
                tap();
                setTargetChannel(1);
              }}
              style={[
                s.channelBtn,
                {
                  backgroundColor: targetChannel === 1 ? `${colors.lamp}20` : colors.surface,
                  borderColor: targetChannel === 1 ? colors.lamp : colors.line,
                },
              ]}
            >
              <Text style={[s.channelText, { color: targetChannel === 1 ? colors.lamp : colors.text }]}>
                {h.names[1] || 'Switch 1'}
              </Text>
            </Press>

            <Press
              onPress={() => {
                tap();
                setTargetChannel(2);
              }}
              style={[
                s.channelBtn,
                {
                  backgroundColor: targetChannel === 2 ? `${colors.lamp}20` : colors.surface,
                  borderColor: targetChannel === 2 ? colors.lamp : colors.line,
                },
              ]}
            >
              <Text style={[s.channelText, { color: targetChannel === 2 ? colors.lamp : colors.text }]}>
                {h.names[2] || 'Switch 2'}
              </Text>
            </Press>

            <Press
              onPress={() => {
                tap();
                setTargetChannel('all');
              }}
              style={[
                s.channelBtn,
                {
                  backgroundColor: targetChannel === 'all' ? `${colors.lamp}20` : colors.surface,
                  borderColor: targetChannel === 'all' ? colors.lamp : colors.line,
                },
              ]}
            >
              <Text style={[s.channelText, { color: targetChannel === 'all' ? colors.lamp : colors.text }]}>
                Both
              </Text>
            </Press>
          </View>

          {/* Repeat */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>REPEAT SCHEDULE</Text>
          <View style={s.rowOptions}>
            {(['Everyday', 'Weekdays', 'Weekends'] as const).map((r) => (
              <Press
                key={r}
                onPress={() => {
                  tap();
                  setRepeat(r);
                }}
                style={[
                  s.repeatBtn,
                  {
                    backgroundColor: repeat === r ? `${colors.cyan}20` : colors.surface,
                    borderColor: repeat === r ? colors.cyan : colors.line,
                  },
                ]}
              >
                <Text style={[s.repeatText, { color: repeat === r ? colors.cyan : colors.dim }]}>{r}</Text>
              </Press>
            ))}
          </View>

          {/* Save Button */}
          <Press
            onPress={handleSave}
            disabled={!name.trim()}
            style={[
              s.saveBtn,
              {
                backgroundColor: name.trim() ? colors.lamp : colors.surface,
                opacity: name.trim() ? 1 : 0.5,
              },
            ]}
          >
            <Text style={s.saveBtnText}>Save Routine</Text>
          </Press>
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
    marginBottom: 14,
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 6,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  input: {
    fontSize: 15,
    fontWeight: '400',
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 12,
  },
  timeCol: {
    alignItems: 'center',
  },
  stepperBtn: {
    padding: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.8,
    marginVertical: 2,
  },
  timeSublabel: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  timeColon: {
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 16,
  },
  ampmWrap: {
    gap: 6,
    marginLeft: 8,
  },
  ampmBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  ampmText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  channelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  channelText: {
    fontSize: 12,
    fontWeight: '300',
  },
  repeatBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
  },
  repeatText: {
    fontSize: 12,
    fontWeight: '400',
  },
  saveBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
