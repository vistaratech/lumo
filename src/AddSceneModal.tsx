import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHome, CustomScene } from './useHome';
import { Press, tap, notify } from './theme';

interface AddSceneModalProps {
  visible: boolean;
  onClose: () => void;
}

const ICONS = [
  'film-outline',
  'tv-outline',
  'musical-notes-outline',
  'flame-outline',
  'moon-outline',
  'sunny-outline',
  'bed-outline',
  'book-outline',
  'game-controller-outline',
  'cafe-outline',
  'wine-outline',
  'fitness-outline',
];

const COLORS = ['#FF9500', '#06D6A0', '#8B5CF6', '#38BDF8', '#F43F5E', '#EAB308'];

export default function AddSceneModal({ visible, onClose }: AddSceneModalProps) {
  const h = useHome();
  const colors = h.colors;

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('film-outline');
  const [selectedColor, setSelectedColor] = useState('#8B5CF6');
  const [r1State, setR1State] = useState<'on' | 'off' | 'keep'>('on');
  const [r2State, setR2State] = useState<'on' | 'off' | 'keep'>('off');

  const handleSave = async () => {
    if (!name.trim()) return;
    tap();
    await h.addCustomScene({
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      r1: r1State === 'keep' ? undefined : r1State === 'on',
      r2: r2State === 'keep' ? undefined : r2State === 'on',
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
              <Text style={[s.title, { color: colors.text }]}>New Scene</Text>
            </View>
            <Press onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.surface }]}>
              <Ionicons name="close" size={20} color={colors.dim} />
            </Press>
          </View>

          {/* Name Input */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>SCENE NAME</Text>
          <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Cinema Mode, Study Time"
              placeholderTextColor={colors.dimmer}
              style={[s.input, { color: colors.text }]}
            />
          </View>

          {/* Icon Picker */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>SELECT ICON</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.iconsRow}>
            {ICONS.map((ic) => {
              const active = selectedIcon === ic;
              return (
                <Press
                  key={ic}
                  onPress={() => {
                    tap();
                    setSelectedIcon(ic);
                  }}
                  style={[
                    s.iconBtn,
                    {
                      backgroundColor: active ? `${selectedColor}22` : colors.surface,
                      borderColor: active ? selectedColor : colors.line,
                    },
                  ]}
                >
                  <Ionicons name={ic as any} size={20} color={active ? selectedColor : colors.dim} />
                </Press>
              );
            })}
          </ScrollView>

          {/* Color Picker */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>THEME ACCENT</Text>
          <View style={s.colorsRow}>
            {COLORS.map((c) => {
              const active = selectedColor === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    tap();
                    setSelectedColor(c);
                  }}
                  style={[
                    s.colorDot,
                    { backgroundColor: c },
                    active && { borderWidth: 3, borderColor: '#FFFFFF' },
                  ]}
                />
              );
            })}
          </View>

          {/* Switch States Configuration */}
          <Text style={[s.fieldLabel, { color: colors.dim }]}>DEVICE ACTIONS</Text>

          {/* Switch 1 */}
          <View style={[s.actionCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[s.actionName, { color: colors.text }]}>{h.names[1] || 'Switch 1'}</Text>
            <View style={s.stateButtons}>
              {(['on', 'off', 'keep'] as const).map((st) => (
                <Press
                  key={st}
                  onPress={() => {
                    tap();
                    setR1State(st);
                  }}
                  style={[
                    s.stateBtn,
                    r1State === st && {
                      backgroundColor: st === 'on' ? colors.ok : st === 'off' ? colors.bad : colors.dim,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.stateBtnText,
                      { color: r1State === st ? '#FFFFFF' : colors.dim },
                    ]}
                  >
                    {st.toUpperCase()}
                  </Text>
                </Press>
              ))}
            </View>
          </View>

          {/* Switch 2 */}
          <View style={[s.actionCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[s.actionName, { color: colors.text }]}>{h.names[2] || 'Switch 2'}</Text>
            <View style={s.stateButtons}>
              {(['on', 'off', 'keep'] as const).map((st) => (
                <Press
                  key={st}
                  onPress={() => {
                    tap();
                    setR2State(st);
                  }}
                  style={[
                    s.stateBtn,
                    r2State === st && {
                      backgroundColor: st === 'on' ? colors.ok : st === 'off' ? colors.bad : colors.dim,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.stateBtnText,
                      { color: r2State === st ? '#FFFFFF' : colors.dim },
                    ]}
                  >
                    {st.toUpperCase()}
                  </Text>
                </Press>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <Press
            onPress={handleSave}
            disabled={!name.trim()}
            style={[
              s.saveBtn,
              {
                backgroundColor: name.trim() ? selectedColor : colors.surface,
                opacity: name.trim() ? 1 : 0.5,
              },
            ]}
          >
            <Text style={s.saveBtnText}>Save Scene</Text>
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
    marginBottom: 16,
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
    marginTop: 12,
    marginBottom: 8,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    fontSize: 15,
    fontWeight: '400',
  },
  iconsRow: {
    gap: 10,
    paddingVertical: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  actionName: {
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: -0.3,
  },
  stateButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  stateBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  stateBtnText: {
    fontSize: 11,
    fontWeight: '600',
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
