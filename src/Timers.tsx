import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CHANNELS } from './config';
import { Header, Press, Ring, mmss, tap } from './theme';
import { useHome } from './useHome';

const PRESETS = [
  { min: 5, label: '5 min' },
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 hr' },
  { min: 120, label: '2 hr' },
];

function CustomModal({
  visible,
  name,
  accentColor,
  onClose,
  onSet,
}: {
  visible: boolean;
  name: string;
  accentColor: string;
  onClose: () => void;
  onSet: (minutes: number) => void;
}) {
  const { colors } = useHome();
  const [mins, setMins] = useState(15);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {/* Header */}
          <View style={s.modalHead}>
            <View>
              <Text style={[s.modalTitle, { color: colors.text }]}>Custom Timer</Text>
              <Text style={[s.modalSub, { color: colors.dim }]}>{name}</Text>
            </View>
            <Press onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.dim} />
            </Press>
          </View>

          {/* Stepper */}
          <View style={[s.stepper, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Press
              onPress={() => {
                tap();
                setMins((m) => Math.max(1, m - 5));
              }}
              style={[s.stepBtn, { borderColor: colors.line }]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Press>

            <View style={{ alignItems: 'center' }}>
              <Text style={[s.stepNum, { color: colors.text }]}>{mins}</Text>
              <Text style={[s.stepUnit, { color: colors.dim }]}>minutes</Text>
            </View>

            <Press
              onPress={() => {
                tap();
                setMins((m) => Math.min(360, m + 5));
              }}
              style={[s.stepBtn, { borderColor: colors.line }]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Press>
          </View>

          {/* Quick choices */}
          <View style={s.quickRow}>
            {[1, 10, 20, 45, 90].map((v) => (
              <Press
                key={v}
                onPress={() => {
                  tap();
                  setMins(v);
                }}
                style={[
                  s.quickChip,
                  {
                    backgroundColor: mins === v ? `${accentColor}18` : colors.surface,
                    borderColor: mins === v ? accentColor : colors.line,
                  },
                ]}
              >
                <Text
                  style={[
                    s.quickText,
                    { color: mins === v ? accentColor : colors.dim, fontWeight: mins === v ? '700' : '500' },
                  ]}
                >
                  {v}m
                </Text>
              </Press>
            ))}
          </View>

          {/* Confirm */}
          <View style={s.modalBtnRow}>
            <Press onPress={onClose} style={[s.cancelBtn, { borderColor: colors.line }]}>
              <Text style={[s.cancelText, { color: colors.dim }]}>Cancel</Text>
            </Press>
            <Press
              onPress={() => {
                tap();
                onSet(mins);
                onClose();
              }}
              style={[s.startBtn, { backgroundColor: accentColor }]}
            >
              <Text style={s.startText}>Start {mins}m Timer</Text>
            </Press>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TimerCard({ channel, index }: { channel: (typeof CHANNELS)[number]; index: number }) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const id = channel.id;
  const isOn = !!h.on[id];
  const end = h.timerEnd[id];
  const total = h.timerTotal[id] || 1;
  const left = end ? Math.max(0, Math.round((end - h.now) / 1000)) : 0;
  const active = left > 0;

  const [modalOpen, setModalOpen] = useState(false);
  const accentColor = isDark ? channel.color : channel.colorLight;

  return (
    <Animated.View
      entering={FadeInDown.delay(50 + index * 40).duration(220).easing(Easing.out(Easing.cubic))}
      layout={LinearTransition.duration(200)}
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: active ? (isDark ? channel.darkBorderOn : channel.lightBorderOn) : colors.line,
        },
      ]}
    >
      {/* Top Header: Room & Name on Left, Single Clean Pill on Right */}
      <View style={s.cardHead}>
        <View style={s.titleWrap}>
          <Text style={[s.roomLabel, { color: colors.dim }]}>{channel.room.toUpperCase()}</Text>
          <Text style={[s.switchName, { color: colors.text }]}>{h.names[id]}</Text>
        </View>

        {active ? (
          <View style={[s.pillActive, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` }]}>
            <View style={[s.dotLive, { backgroundColor: accentColor }]} />
            <Text style={[s.pillActiveText, { color: accentColor }]}>{mmss(left)} left</Text>
          </View>
        ) : (
          <View style={[s.pillIdle, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[s.dotIdle, { backgroundColor: isOn ? accentColor : colors.dimmer }]} />
            <Text style={[s.pillIdleText, { color: colors.dim }]}>{isOn ? 'On' : 'Idle'}</Text>
          </View>
        )}
      </View>

      {/* Body: Active Countdown OR Clean Preset Chips */}
      {active ? (
        <Animated.View key="running" entering={FadeIn.duration(250)} style={s.activeBody}>
          <View style={s.activeRow}>
            {/* Minimal Digital Ring */}
            <Ring size={100} stroke={8} progress={left / total} color={accentColor} duration={900}>
              <Text style={[s.countdownTime, { color: colors.text }]}>{mmss(left)}</Text>
            </Ring>

            {/* Clean Actions */}
            <View style={s.activeActions}>
              <Text style={[s.activeSub, { color: colors.dim }]}>Auto-stops when timer ends</Text>

              <View style={s.btnGroup}>
                <Press
                  style={[s.extendBtn, { backgroundColor: colors.surface, borderColor: colors.line }]}
                  onPress={() => {
                    tap();
                    h.extendTimer(id, 5);
                  }}
                >
                  <Ionicons name="add" size={15} color={colors.text} />
                  <Text style={[s.extendText, { color: colors.text }]}>+5 min</Text>
                </Press>

                <Press
                  style={[s.stopBtn, { backgroundColor: `${colors.bad}14`, borderColor: `${colors.bad}35` }]}
                  onPress={() => {
                    tap();
                    h.cancelTimer(id);
                  }}
                >
                  <Ionicons name="close" size={15} color={colors.bad} />
                  <Text style={[s.stopText, { color: colors.bad }]}>Cancel</Text>
                </Press>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="idle" entering={FadeIn.duration(250)} style={s.idleBody}>
          <Text style={[s.sectionSub, { color: colors.dim }]}>QUICK TIMER</Text>

          <View style={s.presetGrid}>
            {PRESETS.map((p) => (
              <Press
                key={p.min}
                style={[s.presetChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
                onPress={() => {
                  tap();
                  h.startTimer(id, p.min);
                }}
              >
                <Text style={[s.presetText, { color: colors.text }]}>{p.label}</Text>
              </Press>
            ))}

            <Press
              style={[
                s.presetChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
              onPress={() => {
                tap();
                setModalOpen(true);
              }}
            >
              <Ionicons name="options-outline" size={14} color={colors.dim} />
              <Text style={[s.presetText, { color: colors.dim }]}>Custom</Text>
            </Press>
          </View>
        </Animated.View>
      )}

      {/* Custom Timer Modal */}
      <CustomModal
        visible={modalOpen}
        name={h.names[id]}
        accentColor={accentColor}
        onClose={() => setModalOpen(false)}
        onSet={(m) => h.startTimer(id, m)}
      />
    </Animated.View>
  );
}

export default function Timers() {
  const { colors } = useHome();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
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
  list: { paddingHorizontal: 20, gap: 14 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleWrap: { gap: 2 },
  roomLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  switchName: {
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: -0.6,
  },
  pillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  dotLive: { width: 6, height: 6, borderRadius: 3 },
  pillActiveText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pillIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  dotIdle: { width: 6, height: 6, borderRadius: 3 },
  pillIdleText: { fontSize: 12, fontWeight: '500' },

  /* Idle Section */
  idleBody: { gap: 8 },
  sectionSub: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 70,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
  },

  /* Active Section */
  activeBody: { paddingTop: 4 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  countdownTime: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  activeActions: {
    flex: 1,
    gap: 10,
  },
  activeSub: {
    fontSize: 12,
    fontWeight: '300',
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  extendText: {
    fontSize: 13,
    fontWeight: '400',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  stopText: {
    fontSize: 13,
    fontWeight: '400',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 20, fontWeight: '300', letterSpacing: -0.5 },
  modalSub: { fontSize: 13, fontWeight: '300', marginTop: 2 },
  closeBtn: { padding: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stepUnit: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  quickRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickText: { fontSize: 12 },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
  startBtn: {
    flex: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  startText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
