import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CHANNELS } from './config';
import { Header, Press, Ring, mmss, tap } from './theme';
import { useHome } from './useHome';

const DURATIONS = [
  { min: 15, label: '15 min', color: '#FF9500', icon: 'time-outline' },
  { min: 30, label: '30 min', color: '#EC4899', icon: 'hourglass-outline' },
  { min: 60, label: '1 hour', color: '#8B5CF6', icon: 'timer-outline' },
  { min: 120, label: '2 hours', color: '#3B82F6', icon: 'alarm-outline' },
  { min: 240, label: '4 hours', color: '#06D6A0', icon: 'moon-outline' },
];

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
  const end = h.timerEnd[id];
  const total = h.timerTotal[id] || 1;
  const left = end ? Math.max(0, Math.round((end - h.now) / 1000)) : 0;
  const active = left > 0;

  const accentColor = isDark ? channel.color : channel.colorLight;

  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 100).springify().damping(18)}
      layout={LinearTransition.springify().damping(18)}
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
        <Animated.View key="running" entering={FadeIn.duration(350)} style={s.runRow}>
          <Ring size={114} stroke={9} progress={left / total} color={accentColor} duration={900}>
            <Text style={[s.time, { color: colors.text }]}>{mmss(left)}</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={[s.hint, { color: colors.dim }]}>Auto turns off when timer hits zero</Text>
            <Press
              style={[s.cancel, { backgroundColor: `${colors.bad}18`, borderColor: colors.bad, borderWidth: 1 }]}
              onPress={() => {
                tap();
                h.cancelTimer(id);
              }}
            >
              <Ionicons name="close-circle" size={16} color={colors.bad} />
              <Text style={[s.cancelText, { color: colors.bad }]}>Cancel timer</Text>
            </Press>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="picker" entering={FadeIn.duration(350)}>
          <Text style={[s.hint, { color: colors.dim, marginBottom: 12 }]}>Set auto-off timer duration</Text>
          <View style={s.chips}>
            {DURATIONS.map((d) => (
              <Press
                key={d.min}
                disabled={!h.ready}
                style={[
                  s.chip,
                  {
                    backgroundColor: isDark ? `${d.color}15` : `${d.color}12`,
                    borderColor: `${d.color}50`,
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
          </View>
        </Animated.View>
      )}
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
  name: { fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
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
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  time: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  cancelText: { fontSize: 13, fontWeight: '700' },
});
