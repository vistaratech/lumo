// Cloud MQTT Broker for worldwide SIM / Wi-Fi remote access
export const BROKER = {
  host: 'broker.emqx.io',
  port: 8084, // Secure WebSocket port (WSS / TLS)
  user: '',   // Empty for public cluster, or set your HiveMQ user
  pass: '',   // Empty for public cluster, or set your HiveMQ pass
};

export const BASE = 'home/esp32';

export const CHANNELS = [
  {
    id: 1,
    name: 'Switch 1',
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
    id: 2,
    name: 'Switch 2',
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
];
