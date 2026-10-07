import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CHANNELS } from './config';
import { Header, Press, Ring, mmss, notify, tap } from './theme';
import { useHome } from './useHome';

const DURATIONS = [
  { min: 1, label: '1 min', color: '#38BDF8', icon: 'flash-outline' },
  { min: 5, label: '5 min', color: '#06D6A0', icon: 'speedometer-outline' },
  { min: 15, label: '15 min', color: '#FF9500', icon: 'time-outline' },
  { min: 30, label: '30 min', color: '#EC4899', icon: 'hourglass-outline' },
  { min: 60, label: '1 hour', color: '#8B5CF6', icon: 'timer-outline' },
  { min: 120, label: '2 hours', color: '#3B82F6', icon: 'moon-outline' },
];

function CustomTimerModal({
  visible,
  channelName,
  accentColor,
  onClose,
  onSet,
}: {
  visible: boolean;
  channelName: string;
  accentColor: string;
  onClose: () => void;
  onSet: (minutes: number) => void;
}) {
  const { colors, isDark } = useHome();
  const [mins, setMins] = useState(10);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={s.modalHeader}>
            <View style={[s.modalIconWrap, { backgroundColor: `${accentColor}20` }]}>
              <Ionicons name="timer" size={20} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Custom Timer</Text>
              <Text style={[s.modalSub, { color: colors.dim }]}>{channelName}</Text>
            </View>
            <Press onPress={onClose} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.dim} />
            </Press>
          </View>

          {/* Stepper display */}
          <View style={[s.stepperBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Press
              onPress={() => {
                tap();
                setMins((m) => Math.max(1, m - 5));
              }}
              style={[s.stepBtn, { borderColor: colors.line }]}
            >
              <Ionicons name="remove" size={22} color={colors.text} />
            </Press>

            <View style={s.stepValueWrap}>
              <Text style={[s.stepNumber, { color: accentColor }]}>{mins}</Text>
              <Text style={[s.stepUnit, { color: colors.dim }]}>minutes</Text>
            </View>

            <Press
              onPress={() => {
                tap();
                setMins((m) => Math.min(360, m + 5));
              }}
              style={[s.stepBtn, { borderColor: colors.line }]}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </Press>
          </View>

          {/* Quick preset adjusters */}
          <View style={s.quickAdjustRow}>
            {[1, 2, 10, 20, 45, 90].map((v) => (
              <Press
                key={v}
                onPress={() => {
                  tap();
                  setMins(v);
                }}
                style={[
                  s.quickPill,
                  {
                    backgroundColor: mins === v ? `${accentColor}25` : colors.card,
                    borderColor: mins === v ? accentColor : colors.line,
                  },
                ]}
              >
                <Text
                  style={[
                    s.quickPillText,
                    { color: mins === v ? accentColor : colors.dim, fontWeight: mins === v ? '700' : '500' },
                  ]}
                >
                  {v}m
                </Text>
              </Press>
            ))}
          </View>

          {/* Actions */}
          <View style={s.modalActionRow}>
            <Press onPress={onClose} style={[s.modalCancelBtn, { borderColor: colors.line }]}>
              <Text style={[s.modalCancelText, { color: colors.dim }]}>Cancel</Text>
            </Press>
            <Press
              onPress={() => {
                tap();
                onSet(mins);
                onClose();
              }}
              style={[s.modalConfirmBtn, { backgroundColor: accentColor }]}
            >
              <Ionicons name="play" size={15} color="#FFFFFF" />
              <Text style={s.modalConfirmText}>Start {mins}m Timer</Text>
            </Press>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TimerCard({
  channel,
  index,
}: {
  channel: (typeof CHANNELS)[number];
  index: number;
}) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const id = channel.id;
  const isOn = !!h.on[id];
  const end = h.timerEnd[id];
  const total = h.timerTotal[id] || 1;
  const left = end ? Math.max(0, Math.round((end - h.now) / 1000)) : 0;
  const active = left > 0;

  const [customModalOpen, setCustomModalOpen] = useState(false);
  const accentColor = isDark ? channel.color : channel.colorLight;

  return (
    <Animated.View
      entering={FadeInDown.delay(60 + index * 50).duration(240).easing(Easing.out(Easing.cubic))}
      layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}
      style={[
        s.card,
        {
          backgroundColor: active
            ? isDark
              ? channel.darkBgOn
              : channel.lightBgOn
            : colors.card,
          borderColor: active
            ? isDark
              ? channel.darkBorderOn
              : channel.lightBorderOn
            : colors.line,
        },
      ]}
    >
      {/* Header of Card */}
      <View style={s.cardTop}>
        <View style={s.channelTag}>
          <View style={[s.tagDot, { backgroundColor: accentColor }]} />
          <Text style={[s.name, { color: colors.text }]}>{h.names[id]}</Text>
          <View
            style={[
              s.switchStatusPill,
              {
                backgroundColor: isOn ? `${accentColor}20` : colors.surface,
                borderColor: isOn ? `${accentColor}40` : colors.line,
              },
            ]}
          >
            <Text style={[s.switchStatusText, { color: isOn ? accentColor : colors.dim }]}>
              {isOn ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        <View
          style={[
            s.badge,
            {
              backgroundColor: active ? `${accentColor}22` : colors.surface,
              borderColor: active ? accentColor : colors.line,
            },
          ]}
        >
          <Text style={[s.badgeText, { color: active ? accentColor : colors.dim }]}>
            {active ? 'RUNNING' : 'IDLE'}
          </Text>
        </View>
      </View>

      {active ? (
        <Animated.View key="running" entering={FadeIn.duration(350)} style={s.runContainer}>
          <View style={s.runRow}>
            <Ring size={118} stroke={10} progress={left / total} color={accentColor} duration={900}>
              <Text style={[s.time, { color: colors.text }]}>{mmss(left)}</Text>
            </Ring>

            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[s.hint, { color: colors.dim }]}>Auto turns off when timer hits zero</Text>

              {/* Quick Extend Buttons */}
              <View style={s.extendRow}>
                <Press
                  style={[s.extendBtn, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` }]}
                  onPress={() => {
                    tap();
                    h.extendTimer(id, 5);
                  }}
                >
                  <Ionicons name="add" size={13} color={accentColor} />
                  <Text style={[s.extendBtnText, { color: accentColor }]}>+5m</Text>
                </Press>

                <Press
                  style={[s.extendBtn, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` }]}
                  onPress={() => {
                    tap();
                    h.extendTimer(id, 15);
                  }}
                >
                  <Ionicons name="add" size={13} color={accentColor} />
                  <Text style={[s.extendBtnText, { color: accentColor }]}>+15m</Text>
                </Press>
              </View>

              {/* Cancel / Stop Buttons */}
              <View style={s.actionRow}>
                <Press
                  style={[s.cancel, { backgroundColor: `${colors.bad}15`, borderColor: colors.bad }]}
                  onPress={() => {
                    tap();
                    h.cancelTimer(id);
                  }}
                >
                  <Ionicons name="close-circle-outline" size={15} color={colors.bad} />
                  <Text style={[s.cancelText, { color: colors.bad }]}>Cancel Timer</Text>
                </Press>

                <Press
                  style={[s.turnOffBtn, { backgroundColor: colors.surface, borderColor: colors.line }]}
                  onPress={() => {
                    tap();
                    h.toggle(id);
                  }}
                >
                  <Ionicons name="power" size={14} color={colors.dim} />
                  <Text style={[s.turnOffText, { color: colors.dim }]}>Turn Off Now</Text>
                </Press>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="picker" entering={FadeIn.duration(350)}>
          <Text style={[s.hint, { color: colors.dim, marginBottom: 12 }]}>
            Choose auto-off timer duration (turns switch ON and auto-stops)
          </Text>
          <View style={s.chips}>
            {DURATIONS.map((d) => (
              <Press
                key={d.min}
                style={[
                  s.chip,
                  {
                    backgroundColor: isDark ? `${d.color}15` : `${d.color}10`,
                    borderColor: `${d.color}45`,
                  },
                ]}
                onPress={() => {
                  tap();
                  h.startTimer(id, d.min);
                }}
              >
                <Ionicons name={d.icon as any} size={15} color={d.color} />
                <Text style={[s.chipText, { color: isDark ? '#FFFFFF' : d.color }]}>{d.label}</Text>
              </Press>
            ))}

            {/* Custom Minutes Chip */}
            <Press
              style={[
                s.chip,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                  borderColor: colors.line,
                },
              ]}
              onPress={() => {
                tap();
                setCustomModalOpen(true);
              }}
            >
              <Ionicons name="options-outline" size={15} color={colors.text} />
              <Text style={[s.chipText, { color: colors.text }]}>Custom...</Text>
            </Press>
          </View>
        </Animated.View>
      )}

      {/* Custom Duration Selector Modal */}
      <CustomTimerModal
        visible={customModalOpen}
        channelName={h.names[id]}
        accentColor={accentColor}
        onClose={() => setCustomModalOpen(false)}
        onSet={(m) => h.startTimer(id, m)}
      />
    </Animated.View>
  );
}

export default function Timers() {
  const { colors } = useHome();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
      <Header
        title="Timers"
        sub="Auto-off countdowns for your switches"
        colors={colors}
      />
      <View style={s.list}>
        {CHANNELS.map((ch, i) => (
          <TimerCard key={ch.id} channel={ch} index={i} />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 16 },
  card: {
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  channelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  switchStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchStatusText: { fontSize: 10, fontWeight: '700' },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  hint: { fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  runContainer: { gap: 12 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  time: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  extendRow: { flexDirection: 'row', gap: 8 },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  extendBtnText: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelText: { fontSize: 12, fontWeight: '700' },
  turnOffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  turnOffText: { fontSize: 12, fontWeight: '600' },

  /* Custom Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    gap: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSub: { fontSize: 13, marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueWrap: { alignItems: 'center' },
  stepNumber: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stepUnit: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  quickAdjustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  quickPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickPillText: { fontSize: 13 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
