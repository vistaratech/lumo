// Fill these in (same broker values as the ESP32 firmware)
export const BROKER = {
  host: 'YOUR-CLUSTER.s1.eu.hivemq.cloud',
  port: 8884, // secure WebSocket port on HiveMQ Cloud
  user: 'YOUR_USER',
  pass: 'YOUR_PASS',
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
