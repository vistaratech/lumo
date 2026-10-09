// Cloud MQTT Broker for worldwide SIM / Wi-Fi remote access
export const BROKER = {
  host: 'broker.emqx.io',
  port: 8084, // Secure WebSocket port (WSS / TLS)
  user: '',   // Empty for public cluster, or set your HiveMQ user
  pass: '',   // Empty for public cluster, or set your HiveMQ pass
};

export const BASE = 'home/esp32';

export interface DeviceModel {
  id: string;
  name: string;
  channels: number;
  tag: string;
  desc: string;
  badgeColor: string;
}

export const DEVICE_MODELS: DeviceModel[] = [
  {
    id: 'lumo-r1',
    name: 'LUMO R1',
    channels: 1,
    tag: '1 Gang',
    desc: 'Single Channel Smart Relay Controller',
    badgeColor: '#38BDF8',
  },
  {
    id: 'lumo-r2',
    name: 'LUMO R2',
    channels: 2,
    tag: '2 Gang',
    desc: 'Dual Channel Smart Relay Controller',
    badgeColor: '#06D6A0',
  },
  {
    id: 'lumo-r3',
    name: 'LUMO R3',
    channels: 3,
    tag: '3 Gang',
    desc: 'Triple Channel Smart Relay Controller',
    badgeColor: '#F59E0B',
  },
  {
    id: 'lumo-r4',
    name: 'LUMO R4',
    channels: 4,
    tag: '4 Gang',
    desc: 'Quad Channel Smart Relay Controller',
    badgeColor: '#8B5CF6',
  },
  {
    id: 'lumo-r6',
    name: 'LUMO R6',
    channels: 6,
    tag: '6 Gang',
    desc: '6-Channel Smart Home Relay Hub',
    badgeColor: '#EC4899',
  },
  {
    id: 'lumo-r8',
    name: 'LUMO R8',
    channels: 8,
    tag: '8 Gang',
    desc: '8-Channel Industrial Relay Controller',
    badgeColor: '#10B981',
  },
  {
    id: 'lumo-r12',
    name: 'LUMO R12',
    channels: 12,
    tag: '12 Gang',
    desc: '12-Channel Distribution Hub',
    badgeColor: '#6366F1',
  },
  {
    id: 'lumo-r16',
    name: 'LUMO R16',
    channels: 16,
    tag: '16 Gang',
    desc: '16-Channel Master Control Station',
    badgeColor: '#F97316',
  },
];

export interface ChannelConfig {
  id: number;
  name: string;
  color: string;
  colorLight: string;
  glow: string;
  icon: string;
  room: string;
  darkBgOn: string;
  lightBgOn: string;
  darkBorderOn: string;
  lightBorderOn: string;
}

export const CHANNEL_PALETTES = [
  {
    color: '#FF9500',
    colorLight: '#D97706',
    glow: '#FFB800',
    icon: 'bulb',
    room: 'Living Room',
    darkBgOn: '#2A1A0B',
    lightBgOn: '#FFF7ED',
    darkBorderOn: '#8A5314',
    lightBorderOn: '#FDBA74',
  },
  {
    color: '#06D6A0',
    colorLight: '#059669',
    glow: '#00F5D4',
    icon: 'flash',
    room: 'Bedroom',
    darkBgOn: '#082520',
    lightBgOn: '#ECFDF5',
    darkBorderOn: '#0D6853',
    lightBorderOn: '#6EE7B7',
  },
  {
    color: '#38BDF8',
    colorLight: '#0284C7',
    glow: '#38BDF8',
    icon: 'power',
    room: 'Kitchen',
    darkBgOn: '#0C2233',
    lightBgOn: '#F0F9FF',
    darkBorderOn: '#075985',
    lightBorderOn: '#BAE6FD',
  },
  {
    color: '#A855F7',
    colorLight: '#9333EA',
    glow: '#C084FC',
    icon: 'tv',
    room: 'Hall',
    darkBgOn: '#201138',
    lightBgOn: '#FAF5FF',
    darkBorderOn: '#6B21A8',
    lightBorderOn: '#E9D5FF',
  },
  {
    color: '#EC4899',
    colorLight: '#DB2777',
    glow: '#F472B6',
    icon: 'snow',
    room: 'Balcony',
    darkBgOn: '#300D20',
    lightBgOn: '#FDF2F8',
    darkBorderOn: '#9D174D',
    lightBorderOn: '#FBCFE8',
  },
  {
    color: '#F59E0B',
    colorLight: '#D97706',
    glow: '#FBBF24',
    icon: 'flame',
    room: 'Dining Room',
    darkBgOn: '#2A1D07',
    lightBgOn: '#FFFBEB',
    darkBorderOn: '#B45309',
    lightBorderOn: '#FDE68A',
  },
  {
    color: '#10B981',
    colorLight: '#059669',
    glow: '#34D399',
    icon: 'water',
    room: 'Garden',
    darkBgOn: '#06261A',
    lightBgOn: '#ECFDF5',
    darkBorderOn: '#047857',
    lightBorderOn: '#A7F3D0',
  },
  {
    color: '#6366F1',
    colorLight: '#4F46E5',
    glow: '#818CF8',
    icon: 'radio',
    room: 'Office',
    darkBgOn: '#151733',
    lightBgOn: '#EEF2FF',
    darkBorderOn: '#4338CA',
    lightBorderOn: '#C7D2FE',
  },
  {
    color: '#14B8A6',
    colorLight: '#0D9488',
    glow: '#2DD4BF',
    icon: 'wifi',
    room: 'Study Room',
    darkBgOn: '#062826',
    lightBgOn: '#F0FDFA',
    darkBorderOn: '#0F766E',
    lightBorderOn: '#99F6E4',
  },
  {
    color: '#F43F5E',
    colorLight: '#E11D48',
    glow: '#FB7185',
    icon: 'sunny',
    room: 'Terrace',
    darkBgOn: '#2E0914',
    lightBgOn: '#FFF1F2',
    darkBorderOn: '#BE123C',
    lightBorderOn: '#FECDD3',
  },
  {
    color: '#84CC16',
    colorLight: '#65A30D',
    glow: '#A3E635',
    icon: 'leaf',
    room: 'Backyard',
    darkBgOn: '#1A2906',
    lightBgOn: '#F7FEE7',
    darkBorderOn: '#4D7C0F',
    lightBorderOn: '#D9F99D',
  },
  {
    color: '#0EA5E9',
    colorLight: '#0284C7',
    glow: '#38BDF8',
    icon: 'partly-sunny',
    room: 'Corridor',
    darkBgOn: '#041F30',
    lightBgOn: '#F0F9FF',
    darkBorderOn: '#0369A1',
    lightBorderOn: '#BAE6FD',
  },
  {
    color: '#D946EF',
    colorLight: '#C026D3',
    glow: '#E879F9',
    icon: 'prism',
    room: 'Guest Room',
    darkBgOn: '#290630',
    lightBgOn: '#FDF4FF',
    darkBorderOn: '#A21CAF',
    lightBorderOn: '#F5D0FE',
  },
  {
    color: '#EAB308',
    colorLight: '#CA8A04',
    glow: '#FACC15',
    icon: 'sunny',
    room: 'Garage',
    darkBgOn: '#2A2004',
    lightBgOn: '#FEFCE8',
    darkBorderOn: '#A16207',
    lightBorderOn: '#FEF08A',
  },
  {
    color: '#06B6D4',
    colorLight: '#0891B2',
    glow: '#22D3EE',
    icon: 'flashlight',
    room: 'Porch',
    darkBgOn: '#042228',
    lightBgOn: '#ECFEFF',
    darkBorderOn: '#0E7490',
    lightBorderOn: '#A5F3FC',
  },
  {
    color: '#FB7185',
    colorLight: '#F43F5E',
    glow: '#FDA4AF',
    icon: 'star',
    room: 'Master Bedroom',
    darkBgOn: '#2E0E16',
    lightBgOn: '#FFF1F2',
    darkBorderOn: '#BE123C',
    lightBorderOn: '#FECDD3',
  },
];

export function generateChannels(
  count: number,
  customNames?: Record<number, string>,
  customRooms?: Record<number, string>
): ChannelConfig[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const id = i + 1;
    const palette = CHANNEL_PALETTES[i % CHANNEL_PALETTES.length];
    return {
      id,
      name: customNames?.[id] || `Switch ${id}`,
      color: palette.color,
      colorLight: palette.colorLight,
      glow: palette.glow,
      icon: palette.icon,
      room: customRooms?.[id] || palette.room,
      darkBgOn: palette.darkBgOn,
      lightBgOn: palette.lightBgOn,
      darkBorderOn: palette.darkBorderOn,
      lightBorderOn: palette.lightBorderOn,
    };
  });
}

// Default 2 channels for fallback/backward compatibility
export const CHANNELS: ChannelConfig[] = generateChannels(2);

