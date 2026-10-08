import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import Paho from 'paho-mqtt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE, BROKER, CHANNELS } from './config';
import { ThemeColors, ThemeMode, darkColors, feel, lightColors, notify, tap } from './theme';
import { addBleDataListener, addBleListener, autoReconnectBle, isBleConnected, sendBleCommand } from './bluetooth';
import { LumoUser, addAuthListener, initAuth, signOut as authSignOut, getUserMqttPrefix } from './auth';
import {
  NotificationPrefs,
  getNotificationPrefs,
  registerForPushNotificationsAsync,
  scheduleSmartReminders,
  sendInstantNotification,
  updateStoredPrefs,
} from './notifications';

type Rec<T> = Record<number, T>;

export interface ScannedWifi {
  ssid: string;
  rssi: number;
  locked: boolean;
}

export interface CustomScene {
  id: string;
  name: string;
  icon: string;
  color?: string;
  r1?: boolean;
  r2?: boolean;
  timerMinutes?: number;
  isCustom?: boolean;
}

export interface ScheduleItem {
  id: string;
  name: string;
  enabled: boolean;
  time: string;
  days: string[];
  action: 'on' | 'off';
  channelId: number | 'all';
}

export interface EnergyStats {
  totalSeconds: number;
  totalKWh: number;
  totalCost: number;
  channels: Record<number, { seconds: number; kWh: number; cost: number }>;
}

export interface WeeklyEnergyDay {
  date: string;
  dayLabel: string;
  kWh: number;
  cost: number;
  seconds: number;
}

type Ctx = {
  brokerUp: boolean;
  deviceUp: boolean;
  bleActive: boolean;
  bleDeviceName: string | null;
  ready: boolean;
  now: number;
  on: Rec<boolean>;
  since: Rec<number | null>;
  pending: Rec<boolean>;
  timerEnd: Rec<number | null>;
  timerTotal: Rec<number>;
  names: Rec<string>;
  rooms: Rec<string>;
  haptics: boolean;
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  C: ThemeColors;
  wifiStatus: 'connected' | 'connecting' | 'failed' | 'disconnected' | 'unknown';
  wifiSsid: string | null;
  wifiIp: string | null;
  scannedWifiList: ScannedWifi[];
  isScanningWifi: boolean;
  setName: (id: number, name: string) => void;
  setRoom: (id: number, room: string) => void;
  setHaptics: (v: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggle: (id: number) => void;
  send: (id: number, value: boolean) => void;
  allSet: (value: boolean) => void;
  startTimer: (id: number, minutes: number) => void;
  cancelTimer: (id: number) => void;
  reconnect: () => void;
  configureWifi: (ssid: string, pass: string) => Promise<boolean>;
  clearWifi: () => Promise<boolean>;
  refreshWifi: () => void;
  scanWifi: () => void;
  extendTimer: (id: number, minutes: number) => void;

  // New Smart Features
  scenes: CustomScene[];
  addCustomScene: (scene: Omit<CustomScene, 'id' | 'isCustom'>) => Promise<void>;
  removeCustomScene: (id: string) => Promise<void>;
  activateScene: (scene: CustomScene) => void;

  schedules: ScheduleItem[];
  addSchedule: (sch: Omit<ScheduleItem, 'id'>) => Promise<void>;
  toggleSchedule: (id: string) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;

  wattage: Record<number, number>;
  setWattage: (channelId: number, watts: number) => Promise<void>;
  tariff: number;
  setTariff: (rate: number) => Promise<void>;
  getTodayStats: () => EnergyStats;
  getWeeklyStats: () => WeeklyEnergyDay[];

  nightGuard: { enabled: boolean; maxHours: number };
  setNightGuard: (cfg: { enabled: boolean; maxHours: number }) => Promise<void>;

  executeVoiceCommand: (cmd: string) => { success: boolean; message: string; action: string };

  // Customer Account & Household Auth
  user: LumoUser | null;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signOutUser: () => Promise<void>;

  // Smart & Push Notifications
  notificationPrefs: NotificationPrefs;
  updateNotificationPrefs: (p: Partial<NotificationPrefs>) => Promise<void>;
  sendTestNotification: () => Promise<void>;
};

const HomeCtx = createContext<Ctx>({} as Ctx);
export const useHome = () => useContext(HomeCtx);

const TIMERS_STORAGE_KEY = 'lumo.active_timers';
const RELAYS_STORAGE_KEY = 'lumo.relay_states';
const RELAYS_SINCE_KEY = 'lumo.relay_since';
const SCENES_STORAGE_KEY = 'lumo.custom_scenes';
const SCHEDULES_STORAGE_KEY = 'lumo.daily_schedules';
const WATTAGE_STORAGE_KEY = 'lumo.wattage';
const TARIFF_STORAGE_KEY = 'lumo.tariff';
const ENERGY_STORAGE_KEY = 'lumo.energy_history';
const NIGHT_GUARD_STORAGE_KEY = 'lumo.night_guard';

const DEFAULT_SCENES: CustomScene[] = [
  { id: 'all_off', name: 'All Off', icon: 'power-outline', color: '#F43F5E', r1: false, r2: false },
  { id: 'full_light', name: 'Full Light', icon: 'sunny-outline', color: '#FF9F1C', r1: true, r2: true },
  { id: 'night_30m', name: 'Night (30m)', icon: 'bed-outline', color: '#06D6A0', r1: false, r2: false, timerMinutes: 30 },
  { id: 'reading', name: 'Reading', icon: 'book-outline', color: '#8B5CF6', r1: true, r2: false },
];

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  { id: 'sch_1', name: 'Evening Porch Light', enabled: true, time: '18:30', days: ['Everyday'], action: 'on', channelId: 1 },
  { id: 'sch_2', name: 'Morning Sunrise Off', enabled: true, time: '06:00', days: ['Everyday'], action: 'off', channelId: 1 },
];

async function loadPersistedTimers(): Promise<Record<number, { end: number; total: number }>> {
  try {
    const raw = await AsyncStorage.getItem(TIMERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function persistTimer(id: number, end: number, total: number) {
  try {
    const current = await loadPersistedTimers();
    current[id] = { end, total };
    await AsyncStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

async function clearPersistedTimer(id: number) {
  try {
    const current = await loadPersistedTimers();
    delete current[id];
    await AsyncStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

async function loadPersistedRelayStates(): Promise<{ on: Rec<boolean>; since: Rec<number | null> }> {
  try {
    const [rawOn, rawSince] = await Promise.all([
      AsyncStorage.getItem(RELAYS_STORAGE_KEY),
      AsyncStorage.getItem(RELAYS_SINCE_KEY),
    ]);
    return {
      on: rawOn ? JSON.parse(rawOn) : {},
      since: rawSince ? JSON.parse(rawSince) : {},
    };
  } catch {
    return { on: {}, since: {} };
  }
}

async function persistRelayStates(on: Rec<boolean>, since?: Rec<number | null>) {
  try {
    await AsyncStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(on));
    if (since) {
      await AsyncStorage.setItem(RELAYS_SINCE_KEY, JSON.stringify(since));
    }
  } catch {}
}

export function HomeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const client = useRef<Paho.Client | null>(null);
  const onRef = useRef<Rec<boolean>>({});
  const pendingRef = useRef<Rec<boolean>>({});

  const [brokerUp, setBrokerUp] = useState(false);
  const [deviceUp, setDeviceUp] = useState(false);
  const [on, setOn] = useState<Rec<boolean>>({});
  const [since, setSince] = useState<Rec<number | null>>({});
  const [pending, setPending] = useState<Rec<boolean>>({});
  const [timerEnd, setTimerEnd] = useState<Rec<number | null>>({});
  const [timerTotal, setTimerTotal] = useState<Rec<number>>({});
  const [names, setNames] = useState<Rec<string>>(Object.fromEntries(CHANNELS.map((c) => [c.id, c.name])));
  const [rooms, setRooms] = useState<Rec<string>>(Object.fromEntries(CHANNELS.map((c) => [c.id, c.room])));
  const [haptics, setHapticsState] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [now, setNow] = useState(Date.now());

  const [bleActive, setBleActive] = useState(isBleConnected());
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);

  const [wifiStatus, setWifiStatus] = useState<'connected' | 'connecting' | 'failed' | 'disconnected' | 'unknown'>('unknown');
  const [wifiSsid, setWifiSsid] = useState<string | null>(null);
  const [wifiIp, setWifiIp] = useState<string | null>(null);

  const [scannedWifiList, setScannedWifiList] = useState<ScannedWifi[]>([]);
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New Smart Features State
  const [scenes, setScenes] = useState<CustomScene[]>(DEFAULT_SCENES);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(DEFAULT_SCHEDULES);
  const [wattage, setWattageState] = useState<Record<number, number>>({ 1: 20, 2: 40 });
  const [tariff, setTariffState] = useState<number>(4.5);
  const [energyHistory, setEnergyHistory] = useState<Record<string, Record<number, number>>>({});
  const [nightGuard, setNightGuardState] = useState<{ enabled: boolean; maxHours: number }>({ enabled: false, maxHours: 4 });
  const lastScheduleTriggerMinute = useRef<string>('');

  // Customer Account & Household Auth State
  const [user, setUser] = useState<LumoUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Smart & Push Notifications State
  const [notificationPrefs, setNotificationPrefsState] = useState<NotificationPrefs>({
    enabled: true,
    nightReminder: true,
    morningDigest: true,
    timerAlerts: true,
    pushToken: null,
    permissionGranted: false,
  });

  useEffect(() => {
    initAuth().then((u) => setUser(u)).catch(() => {});
    const unsub = addAuthListener((u) => setUser(u));

    // Initialize notification permissions & scheduled reminders
    getNotificationPrefs().then((p) => {
      setNotificationPrefsState(p);
      registerForPushNotificationsAsync().then((token) => {
        getNotificationPrefs().then(setNotificationPrefsState);
        scheduleSmartReminders();
      });
    });

    return unsub;
  }, []);

  const updateNotificationPrefs = async (partial: Partial<NotificationPrefs>) => {
    const updated = await updateStoredPrefs(partial);
    setNotificationPrefsState(updated);
  };

  const sendTestNotification = async () => {
    tap();
    await sendInstantNotification(
      '💡 Lumo Smart Home',
      'Your Lumo notifications are working perfectly! ✨',
      { test: true }
    );
    notify('success');
  };

  const openAuthModal = () => setAuthModalOpen(true);
  const closeAuthModal = () => setAuthModalOpen(false);
  const signOutUser = async () => {
    await authSignOut();
  };

  /* Load cached Wi-Fi SSID and Smart Home Features from storage */
  useEffect(() => {
    AsyncStorage.getItem('lumo.wifi_ssid')
      .then((s) => {
        if (s) setWifiSsid(s);
      })
      .catch(() => {});

    // Load custom scenes
    AsyncStorage.getItem(SCENES_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const custom = JSON.parse(data);
          setScenes([...DEFAULT_SCENES, ...custom]);
        } catch {}
      }
    }).catch(() => {});

    // Load daily schedules
    AsyncStorage.getItem(SCHEDULES_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setSchedules(JSON.parse(data));
        } catch {}
      }
    }).catch(() => {});

    // Load custom wattage
    AsyncStorage.getItem(WATTAGE_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setWattageState(JSON.parse(data));
        } catch {}
      }
    }).catch(() => {});

    // Load tariff
    AsyncStorage.getItem(TARIFF_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const t = parseFloat(data);
          if (!isNaN(t)) setTariffState(t);
        } catch {}
      }
    }).catch(() => {});

    // Load energy history
    AsyncStorage.getItem(ENERGY_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setEnergyHistory(JSON.parse(data));
        } catch {}
      }
    }).catch(() => {});

    // Load night guard
    AsyncStorage.getItem(NIGHT_GUARD_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setNightGuardState(JSON.parse(data));
        } catch {}
      }
    }).catch(() => {});
  }, []);

  /* Synchronize timers and relay states from storage (handles app restart or returning from background) */
  const syncTimersFromStorage = async () => {
    try {
      const stored = await loadPersistedTimers();
      const nowMs = Date.now();
      let changed = false;
      const newEnd: Rec<number | null> = {};
      const newTotal: Rec<number> = {};
      const currentOn = { ...onRef.current };

      for (const [idStr, data] of Object.entries(stored)) {
        const id = Number(idStr);
        if (data && data.end > nowMs) {
          // Timer is still counting down
          newEnd[id] = data.end;
          newTotal[id] = data.total;
          currentOn[id] = true;
          onRef.current[id] = true;
        } else {
          // Timer finished while app was backgrounded/closed
          delete stored[id];
          changed = true;
          newEnd[id] = null;
          newTotal[id] = 0;
          currentOn[id] = false;
          onRef.current[id] = false;
          // Send OFF command in case device needs cleanup
          sendBleCommand(`R${id}_OFF`).catch(() => {});
          sendBleCommand(`TIMER:${id}:0`).catch(() => {});
        }
      }

      if (changed) {
        await AsyncStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(stored));
      }

      setTimerEnd((s) => ({ ...s, ...newEnd }));
      setTimerTotal((s) => ({ ...s, ...newTotal }));
      setOn((s) => ({ ...s, ...currentOn }));
      persistRelayStates(currentOn);
    } catch (err) {
      console.warn('[Home] Failed to sync timers:', err);
    }
  };

  /* Initial load: immediately restore saved relay states & timers from phone storage (zero flicker/reset) */
  useEffect(() => {
    (async () => {
      try {
        const saved = await loadPersistedRelayStates();
        if (saved.on && Object.keys(saved.on).length > 0) {
          onRef.current = { ...saved.on };
          setOn(saved.on);
        }
        if (saved.since && Object.keys(saved.since).length > 0) {
          setSince(saved.since);
        }
      } catch {}
      await syncTimersFromStorage();
    })();
  }, []);

  /* Auto-reconnect Bluetooth and sync hardware state on launch & whenever app returns to foreground */
  useEffect(() => {
    autoReconnectBle().catch(() => {});

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('[Home] Foreground active: syncing auth, BLE and relay states');
        initAuth().then((u) => { if (u) setUser(u); }).catch(() => {});
        autoReconnectBle().catch(() => {});
        syncTimersFromStorage();
        // Request fresh physical status from ESP32 immediately
        setTimeout(() => {
          sendBleCommand('STATUS').catch(() => {});
          sendBleCommand('GET_WIFI').catch(() => {});
        }, 150);
      }
    });

    return () => sub.remove();
  }, []);

  /* Listen to real Bluetooth connection state and live notifications from ESP32 */
  useEffect(() => {
    const unsubState = addBleListener((connected, name) => {
      setBleActive(connected);
      if (name) setBleDeviceName(name);
      if (connected) {
        setTimeout(() => {
          sendBleCommand('STATUS').catch(() => {});
          sendBleCommand('GET_WIFI').catch(() => {});
        }, 350);
      }
    });

    const unsubData = addBleDataListener((msg) => {
      if (typeof msg !== 'string') return;
      const m1 = msg.match(/R1:([01])/);
      if (m1) {
        const val = m1[1] === '1';
        onRef.current[1] = val;
        setOn((s) => {
          const next = { ...s, 1: val };
          persistRelayStates(next);
          return next;
        });
        setSince((s) => {
          const next = { ...s, 1: val ? s[1] ?? Date.now() : null };
          persistRelayStates(onRef.current, next);
          return next;
        });
        if (!val) {
          setTimerEnd((s) => ({ ...s, 1: null }));
          setTimerTotal((s) => ({ ...s, 1: 0 }));
          clearPersistedTimer(1);
        }
      }
      const m2 = msg.match(/R2:([01])/);
      if (m2) {
        const val = m2[1] === '1';
        onRef.current[2] = val;
        setOn((s) => {
          const next = { ...s, 2: val };
          persistRelayStates(next);
          return next;
        });
        setSince((s) => {
          const next = { ...s, 2: val ? s[2] ?? Date.now() : null };
          persistRelayStates(onRef.current, next);
          return next;
        });
        if (!val) {
          setTimerEnd((s) => ({ ...s, 2: null }));
          setTimerTotal((s) => ({ ...s, 2: 0 }));
          clearPersistedTimer(2);
        }
      }

      // Live timer countdown from hardware: T1:secs, T2:secs
      const t1 = msg.match(/T1:(\d+)/);
      if (t1) {
        const secs = parseInt(t1[1], 10);
        if (secs > 0) {
          const endMs = Date.now() + secs * 1000;
          setTimerEnd((s) => ({ ...s, 1: endMs }));
          setTimerTotal((s) => ({ ...s, 1: Math.max(s[1] || 0, secs) }));
          persistTimer(1, endMs, secs);
        } else {
          setTimerEnd((s) => ({ ...s, 1: null }));
          clearPersistedTimer(1);
        }
      }
      const t2 = msg.match(/T2:(\d+)/);
      if (t2) {
        const secs = parseInt(t2[1], 10);
        if (secs > 0) {
          const endMs = Date.now() + secs * 1000;
          setTimerEnd((s) => ({ ...s, 2: endMs }));
          setTimerTotal((s) => ({ ...s, 2: Math.max(s[2] || 0, secs) }));
          persistTimer(2, endMs, secs);
        } else {
          setTimerEnd((s) => ({ ...s, 2: null }));
          clearPersistedTimer(2);
        }
      }

      // Wi-Fi provisioning state parsing from ESP32
      if (msg.startsWith('WIFI_STATE:CONNECTED')) {
        const parts = msg.split(':');
        const ip = parts[2] || '';
        const ssid = parts.slice(3).join(':') || wifiSsid || '';
        setWifiStatus('connected');
        if (ip) setWifiIp(ip);
        if (ssid) {
          setWifiSsid(ssid);
          AsyncStorage.setItem('lumo.wifi_ssid', ssid).catch(() => {});
        }
      } else if (msg.startsWith('WIFI_STATE:CONNECTING')) {
        const parts = msg.split(':');
        const ssid = parts.slice(2).join(':') || '';
        setWifiStatus('connecting');
        if (ssid) setWifiSsid(ssid);
      } else if (msg.startsWith('WIFI_STATE:FAILED')) {
        setWifiStatus('failed');
      } else if (msg.startsWith('WIFI_STATE:DISCONNECTED') || msg.startsWith('WIFI_STATE:CLEARED')) {
        setWifiStatus('disconnected');
        setWifiIp(null);
      }

      // Parse scanned Wi-Fi network items from ESP32 (supports SSIDs with spaces, colons & emojis)
      if (msg.startsWith('WIFI_NET:') || msg.startsWith('WN:')) {
        const prefixLen = msg.startsWith('WIFI_NET:') ? 9 : 3;
        const rest = msg.substring(prefixLen);
        const lastColon = rest.lastIndexOf(':');
        if (lastColon !== -1) {
          const secondLastColon = rest.lastIndexOf(':', lastColon - 1);
          if (secondLastColon !== -1) {
            const netSsid = rest.substring(0, secondLastColon).trim();
            const rssi = parseInt(rest.substring(secondLastColon + 1, lastColon), 10) || -70;
            const locked = rest.substring(lastColon + 1).trim() === '1';

            if (netSsid.length > 0) {
              setScannedWifiList((prev) => {
                const existingIdx = prev.findIndex((item) => item.ssid === netSsid);
                if (existingIdx !== -1) {
                  const copy = [...prev];
                  copy[existingIdx] = { ssid: netSsid, rssi, locked };
                  return copy;
                }
                return [...prev, { ssid: netSsid, rssi, locked }].sort((a, b) => b.rssi - a.rssi);
              });
            }
          }
        }
      } else if (msg.startsWith('WIFI_SCAN_END') || msg.startsWith('WIFI_SCAN_EMPTY')) {
        setIsScanningWifi(false);
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      }
    });

    return () => {
      unsubState();
      unsubData();
    };
  }, []);

  const isDark = themeMode === 'system' ? systemColorScheme !== 'light' : themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  /* 1-second continuous clock loop: always keeps timers and elapsed times precise */
  useEffect(() => {
    const t = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      // Check if any active timer finished
      setTimerEnd((currentTimers) => {
        let hasExpired = false;
        const updated = { ...currentTimers };

        for (const [idStr, end] of Object.entries(currentTimers)) {
          const id = Number(idStr);
          if (end && currentNow >= end) {
            hasExpired = true;
            updated[id] = null;
            clearPersistedTimer(id);

            // Execute state update for expired relay
            onRef.current[id] = false;
            setOn((s) => {
              const next = { ...s, [id]: false };
              persistRelayStates(next);
              return next;
            });
            setSince((s) => {
              const next = { ...s, [id]: null };
              persistRelayStates(onRef.current, next);
              return next;
            });

            // Send OFF commands to hardware
            sendBleCommand(`R${id}_OFF`).catch(() => {});
            sendBleCommand(`TIMER:${id}:0`).catch(() => {});
            pub(`${BASE}/relay${id}/set`, 'OFF');
            notify('success');

            // Send notification for timer finish
            if (notificationPrefs.enabled && notificationPrefs.timerAlerts) {
              const chName = names[id] || `Switch ${id}`;
              sendInstantNotification(
                '⏱️ Timer Finished',
                `${chName} was turned OFF automatically.`,
                { channelId: id, type: 'timer_finished' }
              );
            }
          }
        }

        return hasExpired ? updated : currentTimers;
      });
    }, 1000);

    return () => clearInterval(t);
  }, []);

  /* saved preferences */
  useEffect(() => {
    AsyncStorage.getItem('lumo.prefs')
      .then((v) => {
        if (!v) return;
        try {
          const p = JSON.parse(v);
          if (p.names) setNames((n) => ({ ...n, ...p.names }));
          if (p.rooms) setRooms((r) => ({ ...r, ...p.rooms }));
          if (typeof p.haptics === 'boolean') {
            feel.haptics = p.haptics;
            setHapticsState(p.haptics);
          }
          if (p.themeMode && (p.themeMode === 'dark' || p.themeMode === 'light' || p.themeMode === 'system')) {
            setThemeModeState(p.themeMode);
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  const save = (n: Rec<string>, rm: Rec<string>, hp: boolean, tm: ThemeMode) =>
    AsyncStorage.setItem('lumo.prefs', JSON.stringify({ names: n, rooms: rm, haptics: hp, themeMode: tm })).catch(() => {});

  const setName = (id: number, name: string) => {
    const n = { ...names, [id]: name };
    setNames(n);
    save(n, rooms, haptics, themeMode);
  };

  const setRoom = (id: number, room: string) => {
    const r = { ...rooms, [id]: room };
    setRooms(r);
    save(names, r, haptics, themeMode);
  };

  const setHaptics = (v: boolean) => {
    feel.haptics = v;
    setHapticsState(v);
    save(names, rooms, v, themeMode);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    save(names, rooms, haptics, mode);
  };

  const setPend = (id: number, v: boolean) => {
    pendingRef.current[id] = v;
    setPending((p) => ({ ...p, [id]: v }));
  };

  /* MQTT — Only connects if real credentials are provided (prevents lag & network hanging) */
  useEffect(() => {
    const isConfigured =
      BROKER.host &&
      !BROKER.host.includes('YOUR-CLUSTER') &&
      !BROKER.host.includes('YOUR_HOST');

    if (!isConfigured) {
      console.log('[Home] MQTT Broker is not configured. Running in fast local Bluetooth mode.');
      return;
    }

    const c = new Paho.Client(BROKER.host, BROKER.port, '/mqtt', 'app-' + Math.random().toString(16).slice(2, 10));
    client.current = c;

    const onConnected = () => {
      setBrokerUp(true);
      c.subscribe(`${BASE}/status`, { qos: 1 });
      c.subscribe(`${BASE}/+/state`, { qos: 1 });
      c.subscribe(`${BASE}/+/timer`, { qos: 1 });
    };
    (c as any).onConnected = onConnected;
    c.onConnectionLost = () => {
      setBrokerUp(false);
      setDeviceUp(false);
    };
    c.onMessageArrived = (m) => {
      const topic = m.destinationName;
      const body = m.payloadString;

      if (topic === `${BASE}/status`) {
        setDeviceUp(body === 'online');
        return;
      }

      const tm = topic.match(/relay(\d)\/timer$/);
      if (tm) {
        const id = Number(tm[1]);
        const secs = parseInt(body, 10) || 0;
        setTimerEnd((s) => ({ ...s, [id]: secs > 0 ? Date.now() + secs * 1000 : null }));
        setTimerTotal((s) => ({ ...s, [id]: secs > 0 ? Math.max(s[id] ?? 0, secs) : 0 }));
        return;
      }

      const sm = topic.match(/relay(\d)\/state$/);
      if (!sm) return;
      const id = Number(sm[1]);
      const val = body === 'ON';
      onRef.current[id] = val;
      setOn((s) => {
        const next = { ...s, [id]: val };
        persistRelayStates(next);
        return next;
      });
      setSince((s) => {
        const next = { ...s, [id]: !val ? null : s[id] ?? Date.now() };
        persistRelayStates(onRef.current, next);
        return next;
      });
      if (!val) {
        setTimerEnd((s) => ({ ...s, [id]: null }));
        setTimerTotal((s) => ({ ...s, [id]: 0 }));
        clearPersistedTimer(id);
      }
      if (pendingRef.current[id]) {
        setPend(id, false);
        notify('success');
      }
    };

    const connectOptions: any = {
      useSSL: true,
      keepAliveInterval: 30,
      timeout: 10,
      reconnect: true,
      onSuccess: onConnected,
      onFailure: (err: any) => {
        console.warn('[MQTT] Connection failed:', err);
        setBrokerUp(false);
      },
    };
    if (BROKER.user) {
      connectOptions.userName = BROKER.user;
      connectOptions.password = BROKER.pass;
    }

    c.connect(connectOptions);
    return () => {
      try {
        c.disconnect();
      } catch {}
    };
  }, []);

  const pub = (topic: string, payload: string) => {
    if (!client.current?.isConnected()) return false;
    const msg = new Paho.Message(payload);
    msg.destinationName = topic;
    msg.qos = 1;
    client.current.send(msg);
    return true;
  };

  const configureWifi = async (ssid: string, pass: string): Promise<boolean> => {
    setWifiStatus('connecting');
    setWifiSsid(ssid);
    AsyncStorage.setItem('lumo.wifi_ssid', ssid).catch(() => {});
    return sendBleCommand(`SET_WIFI:${ssid}:${pass}`);
  };

  const clearWifi = async (): Promise<boolean> => {
    setWifiStatus('disconnected');
    setWifiIp(null);
    setWifiSsid(null);
    AsyncStorage.removeItem('lumo.wifi_ssid').catch(() => {});
    return sendBleCommand('CLEAR_WIFI');
  };

  const refreshWifi = () => {
    sendBleCommand('GET_WIFI').catch(() => {});
  };

  const scanWifi = () => {
    if (!bleActive) return;
    setIsScanningWifi(true);
    setScannedWifiList([]);
    sendBleCommand('SCAN_WIFI').catch(() => {});

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setIsScanningWifi(false);
    }, 12000);
  };

  const send = (id: number, value: boolean) => {
    // 1. Immediately update local ref, React state, and AsyncStorage so toggle is instant and accurate
    onRef.current[id] = value;
    setOn((s) => {
      const next = { ...s, [id]: value };
      persistRelayStates(next);
      return next;
    });
    setSince((s) => {
      const next = { ...s, [id]: value ? Date.now() : null };
      persistRelayStates(onRef.current, next);
      return next;
    });

    // If relay turned off, clear any active timer
    if (!value) {
      setTimerEnd((s) => ({ ...s, [id]: null }));
      setTimerTotal((s) => ({ ...s, [id]: 0 }));
      clearPersistedTimer(id);
      sendBleCommand(`TIMER:${id}:0`).catch(() => {});
      pub(`${BASE}/relay${id}/timer/set`, '0');
    }

    // 2. Send via Bluetooth BLE if connected
    sendBleCommand(`R${id}_${value ? 'ON' : 'OFF'}`).catch(() => {});

    // 3. Also publish to MQTT if available
    if (pub(`${BASE}/relay${id}/set`, value ? 'ON' : 'OFF')) {
      setPend(id, true);
      setTimeout(() => {
        if (pendingRef.current[id]) {
          setPend(id, false);
        }
      }, 3000);
    }
  };

  const allSet = (v: boolean) => {
    CHANNELS.forEach((ch) => send(ch.id, v));
  };

  const startTimer = (id: number, minutes: number) => {
    const targetEnd = Date.now() + minutes * 60 * 1000;
    const totalSecs = minutes * 60;

    sendBleCommand(`TIMER:${id}:${minutes}`).catch(() => {});
    setTimerTotal((s) => ({ ...s, [id]: totalSecs }));
    setTimerEnd((s) => ({ ...s, [id]: targetEnd }));
    persistTimer(id, targetEnd, totalSecs);

    onRef.current[id] = true;
    setOn((s) => {
      const next = { ...s, [id]: true };
      persistRelayStates(next);
      return next;
    });
    setSince((s) => {
      const next = { ...s, [id]: s[id] ?? Date.now() };
      persistRelayStates(onRef.current, next);
      return next;
    });

    if (!pub(`${BASE}/relay${id}/timer/set`, String(minutes))) return;
    setPend(id, true);
    setTimeout(() => pendingRef.current[id] && setPend(id, false), 4000);
  };

  const extendTimer = (id: number, extraMinutes: number) => {
    const currentEnd = timerEnd[id] || Date.now();
    const newEnd = Math.max(Date.now(), currentEnd) + extraMinutes * 60 * 1000;
    const remainingSecs = Math.round((newEnd - Date.now()) / 1000);
    const newTotal = (timerTotal[id] || 0) + extraMinutes * 60;

    setTimerEnd((s) => ({ ...s, [id]: newEnd }));
    setTimerTotal((s) => ({ ...s, [id]: newTotal }));
    persistTimer(id, newEnd, newTotal);

    const remainingMinutes = Math.max(1, Math.ceil(remainingSecs / 60));
    sendBleCommand(`TIMER:${id}:${remainingMinutes}`).catch(() => {});
    pub(`${BASE}/relay${id}/timer/set`, String(remainingMinutes));
  };

  /* Live 1s interval ticker: smooth countdowns, schedules, energy tracking, night guard */
  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      tickCount++;

      // Every 10 seconds: Accumulate energy usage for switches that are currently ON
      if (tickCount % 10 === 0) {
        const todayKey = new Date().toISOString().slice(0, 10);
        let updated = false;

        setEnergyHistory((prev) => {
          const dayData = { ...(prev[todayKey] || {}) };
          CHANNELS.forEach((ch) => {
            if (onRef.current[ch.id]) {
              dayData[ch.id] = (dayData[ch.id] || 0) + 10;
              updated = true;
            }
          });
          if (!updated) return prev;
          const next = { ...prev, [todayKey]: dayData };
          AsyncStorage.setItem(ENERGY_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });

        // Check Night Guard
        if (nightGuard.enabled) {
          const maxMs = nightGuard.maxHours * 3600 * 1000;
          CHANNELS.forEach((ch) => {
            if (onRef.current[ch.id] && since[ch.id]) {
              const elapsed = currentNow - since[ch.id]!;
              if (elapsed > maxMs) {
                console.log(`[NightGuard] Auto-turning off channel ${ch.id} after ${nightGuard.maxHours}h`);
                send(ch.id, false);
                if (notificationPrefs.enabled) {
                  const chName = names[ch.id] || `Switch ${ch.id}`;
                  sendInstantNotification(
                    '🛡️ Night Guard Auto-Off',
                    `${chName} was turned off after ${nightGuard.maxHours}h to save electricity.`,
                    { channelId: ch.id, type: 'night_guard' }
                  );
                }
              }
            }
          });
        }
      }

      // Check Daily Schedules once every minute
      const nowObj = new Date();
      const currentHHMM = `${String(nowObj.getHours()).padStart(2, '0')}:${String(nowObj.getMinutes()).padStart(2, '0')}`;
      if (currentHHMM !== lastScheduleTriggerMinute.current) {
        lastScheduleTriggerMinute.current = currentHHMM;
        const currentDayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][nowObj.getDay()];
        schedules.forEach((sch) => {
          if (sch.enabled && sch.time === currentHHMM) {
            const dayMatches =
              sch.days.includes('Everyday') ||
              (sch.days.includes('Weekdays') && nowObj.getDay() >= 1 && nowObj.getDay() <= 5) ||
              (sch.days.includes('Weekends') && (nowObj.getDay() === 0 || nowObj.getDay() === 6)) ||
              sch.days.includes(currentDayName);
            if (dayMatches) {
              const turnOn = sch.action === 'on';
              if (sch.channelId === 'all') {
                allSet(turnOn);
              } else {
                send(sch.channelId, turnOn);
              }
            }
          }
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nightGuard, since, schedules]);

  const addCustomScene = async (newScene: Omit<CustomScene, 'id' | 'isCustom'>) => {
    const id = `scene_${Date.now()}`;
    const item: CustomScene = { ...newScene, id, isCustom: true };
    const nextScenes = [...scenes, item];
    setScenes(nextScenes);
    const customOnly = nextScenes.filter((s) => s.isCustom);
    await AsyncStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(customOnly));
  };

  const removeCustomScene = async (id: string) => {
    const nextScenes = scenes.filter((s) => s.id !== id);
    setScenes(nextScenes);
    const customOnly = nextScenes.filter((s) => s.isCustom);
    await AsyncStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(customOnly));
  };

  const activateScene = (scene: CustomScene) => {
    if (scene.r1 !== undefined) send(1, scene.r1);
    if (scene.r2 !== undefined) send(2, scene.r2);
    if (scene.timerMinutes && scene.timerMinutes > 0) {
      startTimer(1, scene.timerMinutes);
      startTimer(2, scene.timerMinutes);
    }
  };

  const addSchedule = async (newSch: Omit<ScheduleItem, 'id'>) => {
    const id = `sch_${Date.now()}`;
    const item: ScheduleItem = { ...newSch, id };
    const next = [...schedules, item];
    setSchedules(next);
    await AsyncStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
  };

  const toggleSchedule = async (id: string) => {
    const next = schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setSchedules(next);
    await AsyncStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
  };

  const removeSchedule = async (id: string) => {
    const next = schedules.filter((s) => s.id !== id);
    setSchedules(next);
    await AsyncStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
  };

  const setWattage = async (channelId: number, watts: number) => {
    const next = { ...wattage, [channelId]: watts };
    setWattageState(next);
    await AsyncStorage.setItem(WATTAGE_STORAGE_KEY, JSON.stringify(next));
  };

  const setTariff = async (rate: number) => {
    setTariffState(rate);
    await AsyncStorage.setItem(TARIFF_STORAGE_KEY, String(rate));
  };

  const setNightGuard = async (cfg: { enabled: boolean; maxHours: number }) => {
    setNightGuardState(cfg);
    await AsyncStorage.setItem(NIGHT_GUARD_STORAGE_KEY, JSON.stringify(cfg));
  };

  const getTodayStats = (): EnergyStats => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const dayData = energyHistory[todayKey] || {};

    let totalSeconds = 0;
    let totalKWh = 0;
    const channelStats: Record<number, { seconds: number; kWh: number; cost: number }> = {};

    CHANNELS.forEach((ch) => {
      let sec = dayData[ch.id] || 0;
      if (on[ch.id] && since[ch.id]) {
        sec += Math.floor((now - since[ch.id]!) / 1000);
      }
      const watts = wattage[ch.id] || (ch.id === 1 ? 20 : 40);
      const kWh = (sec / 3600) * (watts / 1000);
      const cost = kWh * tariff;

      channelStats[ch.id] = { seconds: sec, kWh, cost };
      totalSeconds += sec;
      totalKWh += kWh;
    });

    const totalCost = totalKWh * tariff;
    return { totalSeconds, totalKWh, totalCost, channels: channelStats };
  };

  const getWeeklyStats = (): WeeklyEnergyDay[] => {
    const days: WeeklyEnergyDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayData = energyHistory[dateKey] || {};

      let daySec = 0;
      let dayKWh = 0;

      CHANNELS.forEach((ch) => {
        let sec = dayData[ch.id] || 0;
        if (i === 0 && on[ch.id] && since[ch.id]) {
          sec += Math.floor((now - since[ch.id]!) / 1000);
        }
        const watts = wattage[ch.id] || (ch.id === 1 ? 20 : 40);
        daySec += sec;
        dayKWh += (sec / 3600) * (watts / 1000);
      });

      const label = i === 0 ? 'Today' : dayNames[d.getDay()];
      days.push({
        date: dateKey,
        dayLabel: label,
        kWh: dayKWh,
        cost: dayKWh * tariff,
        seconds: daySec,
      });
    }

    return days;
  };

  const executeVoiceCommand = (cmd: string): { success: boolean; message: string; action: string } => {
    const query = cmd.toLowerCase().trim();
    if (!query) return { success: false, message: 'Please say or select a command', action: 'NONE' };

    if (query.includes('all on') || query.includes('turn on all') || query.includes('yellam on') || query.includes('both on')) {
      allSet(true);
      return { success: true, message: 'All lights turned ON', action: 'ALL_ON' };
    }
    if (query.includes('all off') || query.includes('turn off all') || query.includes('yellam off') || query.includes('both off')) {
      allSet(false);
      return { success: true, message: 'All lights turned OFF', action: 'ALL_OFF' };
    }

    const ch1Name = (names[1] || 'veli light').toLowerCase();
    const ch2Name = (names[2] || 'bedroom').toLowerCase();
    const ch1Room = (rooms[1] || '').toLowerCase();
    const ch2Room = (rooms[2] || '').toLowerCase();

    const mentions1 = query.includes('1') || query.includes('veli') || query.includes(ch1Name) || (ch1Room ? query.includes(ch1Room) : false) || query.includes('porch');
    const mentions2 = query.includes('2') || query.includes('bedroom') || (ch2Room ? query.includes(ch2Room) : false) || query.includes('living') || query.includes(ch2Name);

    const wantsOff = query.includes('off') || query.includes('aathu') || query.includes('aathi') || query.includes('anaithu');

    if (mentions1) {
      if (wantsOff) {
        send(1, false);
        return { success: true, message: `${names[1]} turned OFF`, action: 'R1_OFF' };
      }
      send(1, true);
      return { success: true, message: `${names[1]} turned ON`, action: 'R1_ON' };
    }

    if (mentions2) {
      if (wantsOff) {
        send(2, false);
        return { success: true, message: `${names[2]} turned OFF`, action: 'R2_OFF' };
      }
      send(2, true);
      return { success: true, message: `${names[2]} turned ON`, action: 'R2_ON' };
    }

    if (query.includes('night') || query.includes('sleep') || query.includes('good night')) {
      allSet(false);
      return { success: true, message: 'Good night! All lights turned OFF', action: 'NIGHT_SCENE' };
    }

    if (query.includes('reading') || query.includes('study')) {
      send(1, true);
      send(2, false);
      return { success: true, message: 'Reading scene activated', action: 'READING_SCENE' };
    }

    return { success: false, message: `Could not recognize "${cmd}". Try "Turn on Veli Light" or "All Off"`, action: 'UNKNOWN' };
  };

  const value: Ctx = {
    brokerUp,
    deviceUp,
    bleActive,
    bleDeviceName,
    ready: bleActive || (brokerUp && deviceUp),
    now,
    on,
    since,
    pending,
    timerEnd,
    timerTotal,
    names,
    rooms,
    haptics,
    themeMode,
    isDark,
    colors,
    C: colors,
    wifiStatus,
    wifiSsid,
    wifiIp,
    scannedWifiList,
    isScanningWifi,
    setName,
    setRoom,
    setHaptics,
    setThemeMode,
    toggle: (id) => {
      const nextVal = !onRef.current[id];
      send(id, nextVal);
    },
    send,
    allSet: (v) => {
      CHANNELS.forEach((ch) => send(ch.id, v));
    },
    startTimer,
    extendTimer,
    cancelTimer: (id) => {
      sendBleCommand(`TIMER:${id}:0`).catch(() => {});
      pub(`${BASE}/relay${id}/timer/set`, '0');
      setTimerEnd((s) => ({ ...s, [id]: null }));
      setTimerTotal((s) => ({ ...s, [id]: 0 }));
      clearPersistedTimer(id);
    },
    reconnect: () => {
      try {
        if (client.current && client.current.isConnected()) {
          client.current.disconnect();
        }
      } catch {}
      setBrokerUp(false);
      setDeviceUp(false);
    },
    configureWifi,
    clearWifi,
    refreshWifi,
    scanWifi,

    // Smart Features
    scenes,
    addCustomScene,
    removeCustomScene,
    activateScene,

    schedules,
    addSchedule,
    toggleSchedule,
    removeSchedule,

    wattage,
    setWattage,
    tariff,
    setTariff,
    getTodayStats,
    getWeeklyStats,

    nightGuard,
    setNightGuard,

    executeVoiceCommand,

    // Customer Account
    user,
    authModalOpen,
    openAuthModal,
    closeAuthModal,
    signOutUser,

    // Smart & Push Notifications
    notificationPrefs,
    updateNotificationPrefs,
    sendTestNotification,
  };

  return <HomeCtx.Provider value={value}>{children}</HomeCtx.Provider>;
}

