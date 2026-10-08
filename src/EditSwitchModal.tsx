import React, { useEffect, useState } from 'react';
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
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHome } from './useHome';
import { CHANNELS } from './config';
import { Press, notify, tap } from './theme';

interface EditSwitchModalProps {
  visible: boolean;
  channelId: number | null;
  onClose: () => void;
}

const ROOM_PRESETS = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Hall',
  'Balcony',
  'Outdoor',
  'Dining',
  'Office',
  'Bathroom',
  'Pooja Room',
  'Terrace',
];

export default function EditSwitchModal({ visible, channelId, onClose }: EditSwitchModalProps) {
  const h = useHome();
  const colors = h.colors;
  const isDark = h.isDark;
  const insets = useSafeAreaInsets();

  const channel = CHANNELS.find((c) => c.id === channelId) || CHANNELS[0];
  const accentColor = isDark ? channel.color : channel.colorLight;

  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

  useEffect(() => {
    if (channelId) {
      setName(h.names[channelId] || channel.name);
      setRoom(h.rooms[channelId] || channel.room);
    }
  }, [channelId, visible, h.names, h.rooms]);

  if (!channelId) return null;

  const handleSave = () => {
    tap();
    const finalName = name.trim() || `Switch ${channelId}`;
    const finalRoom = room.trim() || channel.room;
    h.setName(channelId, finalName);
    h.setRoom(channelId, finalRoom);
    notify('success');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* Backdrop dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.keyboardAvoid}
        >
          <Animated.View
            entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
            style={[
              s.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.line,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            {/* Top Grabber Handle */}
            <View style={[s.handle, { backgroundColor: colors.line }]} />

            {/* Modal Header */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={[s.iconBadge, { backgroundColor: `${accentColor}18` }]}>
                  <Ionicons name={channel.icon as any} size={20} color={accentColor} />
                </View>
                <View>
                  <Text style={[s.title, { color: colors.text }]}>Edit Switch & Room</Text>
                  <Text style={[s.subtitle, { color: colors.dim }]}>
                    Switch {channelId} • Relay Channel {channelId}
                  </Text>
                </View>
              </View>

              <Press onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="close" size={18} color={colors.dim} />
              </Press>
            </View>

            {/* Fields Container */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {/* Switch Name Input */}
              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={[s.label, { color: colors.dim }]}>SWITCH NAME</Text>
                  <Text style={[s.charCount, { color: colors.dimmer }]}>{name.length}/20</Text>
                </View>
                <View
                  style={[
                    s.inputWrap,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <Ionicons name="pricetag-outline" size={17} color={accentColor} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    maxLength={20}
                    placeholder={`e.g. ${channel.name}`}
                    placeholderTextColor={colors.dimmer}
                    selectionColor={accentColor}
                    style={[s.input, { color: colors.text }]}
                  />
                  {name.length > 0 && (
                    <Press onPress={() => setName('')} style={s.clearBtn}>
                      <Ionicons name="close-circle" size={16} color={colors.dim} />
                    </Press>
                  )}
                </View>
              </View>

              {/* Assigned Room Input */}
              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={[s.label, { color: colors.dim }]}>ASSIGNED ROOM</Text>
                  <Text style={[s.charCount, { color: colors.dimmer }]}>{room.length}/20</Text>
                </View>
                <View
                  style={[
                    s.inputWrap,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <Ionicons name="home-outline" size={17} color={accentColor} />
                  <TextInput
                    value={room}
                    onChangeText={setRoom}
                    maxLength={20}
                    placeholder="e.g. Living Room, Bedroom"
                    placeholderTextColor={colors.dimmer}
                    selectionColor={accentColor}
                    style={[s.input, { color: colors.text }]}
                  />
                  {room.length > 0 && (
                    <Press onPress={() => setRoom('')} style={s.clearBtn}>
                      <Ionicons name="close-circle" size={16} color={colors.dim} />
                    </Press>
                  )}
                </View>
              </View>

              {/* Quick Room Preset Chips — Horizontal Scroll */}
              <View style={s.presetSection}>
                <Text style={[s.quickLabel, { color: colors.dim }]}>QUICK ROOM PRESETS</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chipsRow}
                >
                  {ROOM_PRESETS.map((preset) => {
                    const isSelected = room.trim().toLowerCase() === preset.toLowerCase();
                    return (
                      <Press
                        key={preset}
                        onPress={() => {
                          tap();
                          setRoom(preset);
                        }}
                        style={[
                          s.chip,
                          {
                            backgroundColor: isSelected ? `${accentColor}25` : colors.surface,
                            borderColor: isSelected ? accentColor : colors.line,
                          },
                        ]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={accentColor}
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text
                          style={[
                            s.chipText,
                            {
                              color: isSelected ? accentColor : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {preset}
                        </Text>
                      </Press>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Pinned Action Buttons — ALWAYS VISIBLE at bottom! */}
            <View style={s.actionsRow}>
              <Press
                onPress={onClose}
                style={[s.btnCancel, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <Text style={[s.btnCancelText, { color: colors.dim }]}>Cancel</Text>
              </Press>

              <Press
                onPress={handleSave}
                style={[s.btnSave, { backgroundColor: accentColor }]}
              >
                <Ionicons name="checkmark-sharp" size={18} color="#080D18" style={{ marginRight: 6 }} />
                <Text style={s.btnSaveText}>Save Changes</Text>
              </Press>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 42,
    height: 4.5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 10,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  charCount: {
    fontSize: 10,
    fontWeight: '500',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  presetSection: {
    gap: 6,
    marginTop: 2,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 3,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    marginTop: 4,
  },
  btnCancel: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnSave: {
    flex: 2,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080D18',
  },
});
