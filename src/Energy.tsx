import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHome } from './useHome';
import { Glow, Header, Press, tap, notify } from './theme';

export default function Energy() {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const { width } = useWindowDimensions();

  const [editTariff, setEditTariff] = useState(false);
  const [tariffInput, setTariffInput] = useState(String(h.tariff));

  const stats = h.getTodayStats();
  const weekly = h.getWeeklyStats();

  // Find max kWh in the 7 days for bar scaling
  const maxKWh = Math.max(0.1, ...weekly.map((d) => d.kWh));

  const formatHours = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  const handleSaveTariff = async () => {
    const num = parseFloat(tariffInput);
    if (!isNaN(num) && num > 0) {
      tap();
      await h.setTariff(num);
      notify('success');
      setEditTariff(false);
    }
  };

  const handleStepWattage = (chId: number, delta: number) => {
    tap();
    const current = h.wattage[chId] || (chId === 1 ? 20 : 40);
    const next = Math.max(5, Math.min(500, current + delta));
    h.setWattage(chId, next);
  };

  // Monthly projection based on today's run rate
  const monthlyProjection = (stats.totalCost * 30).toFixed(2);

  return (
    <ScrollView
      style={[s.fill, { backgroundColor: colors.night }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <Header
        title="Energy"
        colors={colors}
        badgeIcon="⚡"
        badgeColor="#38BDF8"
      />

      {/* Hero Bill & Usage Card */}
      <Animated.View
        entering={FadeInDown.delay(60).duration(400)}
        style={[
          s.heroCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.line,
            shadowColor: '#38BDF8',
            shadowOpacity: isDark ? 0.2 : 0.08,
          },
        ]}
      >
        <View pointerEvents="none" style={s.heroGlow}>
          <Glow id="energy-glow" size={300} color="#38BDF8" opacity={isDark ? 0.3 : 0.15} />
        </View>

        <View style={s.heroTopRow}>
          <View style={[s.badge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
            <Ionicons name="flash" size={14} color="#38BDF8" />
            <Text style={[s.badgeText, { color: '#38BDF8' }]}>TODAY'S ESTIMATE</Text>
          </View>
          <Text style={[s.tariffPill, { color: colors.dim }]}>@ ₹{h.tariff}/unit</Text>
        </View>

        <Text style={[s.heroCost, { color: colors.text }]}>
          ₹ {stats.totalCost.toFixed(2)}
        </Text>
        <Text style={[s.heroSub, { color: colors.dim }]}>
          {stats.totalKWh.toFixed(3)} kWh
        </Text>

        {/* 2-Column Mini Stat Badges */}
        <View style={s.miniStatsRow}>
          <View style={[s.miniStat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[s.miniStatLabel, { color: colors.dim }]}>ACTIVE RUNTIME</Text>
            <Text style={[s.miniStatVal, { color: colors.text }]}>
              {formatHours(stats.totalSeconds)}
            </Text>
          </View>
          <View style={[s.miniStat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[s.miniStatLabel, { color: colors.dim }]}>EST. MONTHLY</Text>
            <Text style={[s.miniStatVal, { color: colors.lamp }]}>
              ~₹ {monthlyProjection}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* 7-Day Usage Bar Chart */}
      <Animated.View
        entering={FadeInDown.delay(120).duration(400)}
        style={[
          s.chartCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.line,
          },
        ]}
      >
        <View style={s.cardTitleRow}>
          <Text style={[s.cardTitle, { color: colors.text }]}>Weekly Usage</Text>
          <Text style={[s.cardSubtitle, { color: colors.dim }]}>Last 7 days</Text>
        </View>

        <View style={s.barsContainer}>
          {weekly.map((d, idx) => {
            const heightPercent = Math.max(12, Math.round((d.kWh / maxKWh) * 100));
            const isToday = idx === weekly.length - 1;

            return (
              <View key={d.date} style={s.barCol}>
                <Text style={[s.barValueText, { color: isToday ? '#38BDF8' : colors.dimmer }]}>
                  {d.kWh > 0 ? d.kWh.toFixed(2) : '0'}
                </Text>
                <View style={[s.barTrack, { backgroundColor: colors.surface }]}>
                  <View
                    style={[
                      s.barFill,
                      {
                        height: `${heightPercent}%`,
                        backgroundColor: isToday ? '#38BDF8' : isDark ? '#334155' : '#CBD5E1',
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    s.barLabel,
                    {
                      color: isToday ? '#38BDF8' : colors.dim,
                      fontWeight: isToday ? '600' : '300',
                    },
                  ]}
                >
                  {d.dayLabel}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Per-Switch Device Breakdown */}
      <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.dim }]}>DEVICE BREAKDOWN</Text>

        {[1, 2].map((id) => {
          const chStats = stats.channels[id] || { seconds: 0, kWh: 0, cost: 0 };
          const watts = h.wattage[id] || (id === 1 ? 20 : 40);
          const name = h.names[id] || `Switch ${id}`;
          const isOn = h.on[id];

          return (
            <View
              key={id}
              style={[
                s.deviceCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isOn ? (isDark ? '#7C4B18' : '#FED7AA') : colors.line,
                },
              ]}
            >
              <View style={s.deviceCardLeft}>
                <View
                  style={[
                    s.deviceIconBadge,
                    {
                      backgroundColor: isOn ? `${colors.lamp}22` : colors.surface,
                    },
                  ]}
                >
                  <Ionicons
                    name="bulb-outline"
                    size={20}
                    color={isOn ? colors.lamp : colors.dim}
                  />
                </View>
                <View>
                  <Text style={[s.deviceName, { color: colors.text }]}>{name}</Text>
                  <Text style={[s.deviceSub, { color: colors.dim }]}>
                    {watts}W Rated · {formatHours(chStats.seconds)} run today
                  </Text>
                </View>
              </View>

              <View style={s.deviceCardRight}>
                <Text style={[s.deviceCost, { color: colors.text }]}>
                  ₹ {chStats.cost.toFixed(2)}
                </Text>
                <Text style={[s.deviceKWh, { color: colors.dim }]}>
                  {chStats.kWh.toFixed(3)} kWh
                </Text>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Power Settings & Tariff Adjuster */}
      <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.dim }]}>POWER & TARIFF SETTINGS</Text>

        <View style={[s.settingsGroup, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {/* Bulb 1 Wattage */}
          <View style={[s.settingRow, { borderBottomColor: colors.line }]}>
            <View>
              <Text style={[s.settingTitle, { color: colors.text }]}>{h.names[1]} Wattage</Text>
            </View>
            <View style={s.stepperWrap}>
              <Press onPress={() => handleStepWattage(1, -5)} style={[s.stepBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="remove" size={16} color={colors.text} />
              </Press>
              <Text style={[s.stepValue, { color: colors.text }]}>{h.wattage[1] || 20}W</Text>
              <Press onPress={() => handleStepWattage(1, 5)} style={[s.stepBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="add" size={16} color={colors.text} />
              </Press>
            </View>
          </View>

          {/* Bulb 2 Wattage */}
          <View style={[s.settingRow, { borderBottomColor: colors.line }]}>
            <View>
              <Text style={[s.settingTitle, { color: colors.text }]}>{h.names[2]} Wattage</Text>
            </View>
            <View style={s.stepperWrap}>
              <Press onPress={() => handleStepWattage(2, -5)} style={[s.stepBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="remove" size={16} color={colors.text} />
              </Press>
              <Text style={[s.stepValue, { color: colors.text }]}>{h.wattage[2] || 40}W</Text>
              <Press onPress={() => handleStepWattage(2, 5)} style={[s.stepBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="add" size={16} color={colors.text} />
              </Press>
            </View>
          </View>

          {/* EB Tariff Unit Rate */}
          <View style={s.settingRow}>
            <View>
              <Text style={[s.settingTitle, { color: colors.text }]}>EB Electricity Rate</Text>
            </View>
            {!editTariff ? (
              <Press
                onPress={() => {
                  tap();
                  setEditTariff(true);
                }}
                style={[s.editTariffBtn, { backgroundColor: colors.surface }]}
              >
                <Text style={[s.tariffText, { color: '#38BDF8' }]}>₹ {h.tariff} / unit</Text>
                <Ionicons name="pencil" size={13} color="#38BDF8" />
              </Press>
            ) : (
              <View style={s.tariffInputWrap}>
                <TextInput
                  value={tariffInput}
                  onChangeText={setTariffInput}
                  keyboardType="decimal-pad"
                  style={[s.tariffInput, { color: colors.text, backgroundColor: colors.surface }]}
                />
                <Press onPress={handleSaveTariff} style={[s.saveTariffBtn, { backgroundColor: '#38BDF8' }]}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </Press>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: 20 },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 6,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 4,
  },
  heroGlow: { position: 'absolute', top: -100, right: -100 },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tariffPill: {
    fontSize: 12,
    fontWeight: '300',
  },
  heroCost: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1.4,
    marginVertical: 4,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 20,
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniStat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  miniStatVal: {
    fontSize: 17,
    fontWeight: '300',
    letterSpacing: -0.4,
  },
  chartCard: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '300',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 9,
    marginBottom: 6,
    fontWeight: '500',
  },
  barTrack: {
    width: 14,
    height: 90,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 8,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 22,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  deviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '300',
    letterSpacing: -0.3,
  },
  deviceSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '300',
  },
  deviceCardRight: {
    alignItems: 'flex-end',
  },
  deviceCost: {
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: -0.3,
  },
  deviceKWh: {
    fontSize: 11,
    marginTop: 2,
  },
  settingsGroup: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '300',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 42,
    textAlign: 'center',
  },
  editTariffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tariffText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tariffInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tariffInput: {
    width: 70,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  saveTariffBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
