import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import Paho from 'paho-mqtt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE, BROKER, CHANNELS } from './config';
import { ThemeColors, ThemeMode, darkColors, feel, lightColors, notify } from './theme';
import { addBleDataListener, addBleListener, autoReconnectBle, isBleConnected, sendBleCommand } from './bluetooth';

type Rec<T> = Record<number, T>;

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
  haptics: boolean;
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  C: ThemeColors;
  wifiStatus: 'connected' | 'connecting' | 'failed' | 'disconnected' | 'unknown';
  wifiSsid: string | null;
  wifiIp: string | null;
  setName: (id: number, name: string) => void;
  setHaptics: (v: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggle: (id: number) => void;
  allSet: (value: boolean) => void;
  startTimer: (id: number, minutes: number) => void;
  cancelTimer: (id: number) => void;
  reconnect: () => void;
  configureWifi: (ssid: string, pass: string) => Promise<boolean>;
  clearWifi: () => Promise<boolean>;
  refreshWifi: () => void;
};

const HomeCtx = createContext<Ctx>({} as Ctx);
export const useHome = () => useContext(HomeCtx);

const TIMERS_STORAGE_KEY = 'lumo.active_timers';

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
  const [haptics, setHapticsState] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [now, setNow] = useState(Date.now());

  const [bleActive, setBleActive] = useState(isBleConnected());
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);

  const [wifiStatus, setWifiStatus] = useState<'connected' | 'connecting' | 'failed' | 'disconnected' | 'unknown'>('unknown');
  const [wifiSsid, setWifiSsid] = useState<string | null>(null);
  const [wifiIp, setWifiIp] = useState<string | null>(null);

  /* Load cached Wi-Fi SSID from storage */
  useEffect(() => {
    AsyncStorage.getItem('lumo.wifi_ssid')
      .then((s) => {
        if (s) setWifiSsid(s);
      })
      .catch(() => {});
  }, []);

  /* Synchronize timers from storage (handles app restart or returning from background) */
  const syncTimersFromStorage = async () => {
    try {
      const stored = await loadPersistedTimers();
      const nowMs = Date.now();
      let changed = false;
      const newEnd: Rec<number | null> = {};
      const newTotal: Rec<number> = {};
      const newOn: Rec<boolean> = {};

      for (const [idStr, data] of Object.entries(stored)) {
        const id = Number(idStr);
        if (data && data.end > nowMs) {
          // Timer is still counting down
          newEnd[id] = data.end;
          newTotal[id] = data.total;
          newOn[id] = true;
          onRef.current[id] = true;
        } else {
          // Timer finished while app was backgrounded/closed
          delete stored[id];
          changed = true;
          newEnd[id] = null;
          newTotal[id] = 0;
          newOn[id] = false;
          onRef.current[id] = false;
        }
      }

      if (changed) {
        await AsyncStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(stored));
      }

      if (Object.keys(newEnd).length > 0) {
        setTimerEnd((s) => ({ ...s, ...newEnd }));
        setTimerTotal((s) => ({ ...s, ...newTotal }));
        setOn((s) => ({ ...s, ...newOn }));
      }
    } catch (err) {
      console.warn('[Home] Failed to sync timers:', err);
    }
  };

  /* Auto-reconnect Bluetooth and sync timers on launch & whenever app returns to foreground */
  useEffect(() => {
    autoReconnectBle().catch(() => {});
    syncTimersFromStorage();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('[Home] Foreground active: auto-reconnecting BLE and syncing timers');
        autoReconnectBle().catch(() => {});
        syncTimersFromStorage();
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
        setOn((s) => ({ ...s, 1: val }));
        setSince((s) => ({ ...s, 1: val ? s[1] ?? Date.now() : null }));
      }
      const m2 = msg.match(/R2:([01])/);
      if (m2) {
        const val = m2[1] === '1';
        onRef.current[2] = val;
        setOn((s) => ({ ...s, 2: val }));
        setSince((s) => ({ ...s, 2: val ? s[2] ?? Date.now() : null }));
      }

      // Wi-Fi provisioning state parsing from ESP32
      if (msg.startsWith('WIFI_STATE:CONNECTED')) {
        const parts = msg.split(':');
        const ip = parts[2] || '';
        const ssid = parts[3] || wifiSsid || '';
        setWifiStatus('connected');
        if (ip) setWifiIp(ip);
        if (ssid) {
          setWifiSsid(ssid);
          AsyncStorage.setItem('lumo.wifi_ssid', ssid).catch(() => {});
        }
      } else if (msg.startsWith('WIFI_STATE:CONNECTING')) {
        const parts = msg.split(':');
        const ssid = parts[2] || '';
        setWifiStatus('connecting');
        if (ssid) setWifiSsid(ssid);
      } else if (msg.startsWith('WIFI_STATE:FAILED')) {
        setWifiStatus('failed');
      } else if (msg.startsWith('WIFI_STATE:DISCONNECTED') || msg.startsWith('WIFI_STATE:CLEARED')) {
        setWifiStatus('disconnected');
        setWifiIp(null);
      }
    });

    return () => {
      unsubState();
      unsubData();
    };
  }, []);

  const isDark = themeMode === 'system' ? systemColorScheme !== 'light' : themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const anyTimer = Object.values(timerEnd).some(Boolean);

  /* clock: 1s while a timer runs, otherwise 20s */
  useEffect(() => {
    const t = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      // Check if any active timer just finished
      setTimerEnd((currentTimers) => {
        let hasExpired = false;
        const updated = { ...currentTimers };

        for (const [idStr, end] of Object.entries(currentTimers)) {
          const id = Number(idStr);
          if (end && currentNow >= end) {
            hasExpired = true;
            updated[id] = null;
            clearPersistedTimer(id);
            onRef.current[id] = false;
            setOn((s) => ({ ...s, [id]: false }));
            setSince((s) => ({ ...s, [id]: null }));
          }
        }

        return hasExpired ? updated : currentTimers;
      });
    }, anyTimer ? 1000 : 20000);

    return () => clearInterval(t);
  }, [anyTimer]);

  /* saved preferences */
  useEffect(() => {
    AsyncStorage.getItem('lumo.prefs')
      .then((v) => {
        if (!v) return;
        try {
          const p = JSON.parse(v);
          if (p.names) setNames((n) => ({ ...n, ...p.names }));
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

  const save = (n: Rec<string>, hp: boolean, tm: ThemeMode) =>
    AsyncStorage.setItem('lumo.prefs', JSON.stringify({ names: n, haptics: hp, themeMode: tm })).catch(() => {});

  const setName = (id: number, name: string) => {
    const n = { ...names, [id]: name };
    setNames(n);
    save(n, haptics, themeMode);
  };

  const setHaptics = (v: boolean) => {
    feel.haptics = v;
    setHapticsState(v);
    save(names, v, themeMode);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    save(names, haptics, mode);
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
      setOn((s) => ({ ...s, [id]: val }));
      setSince((s) => ({ ...s, [id]: !val ? null : s[id] ?? Date.now() }));
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

  const send = (id: number, value: boolean) => {
    // 1. Immediately update local ref and React state so toggle is instant and accurate
    onRef.current[id] = value;
    setOn((s) => ({ ...s, [id]: value }));
    setSince((s) => ({ ...s, [id]: value ? Date.now() : null }));

    // If relay turned off, clear any active timer
    if (!value) {
      setTimerEnd((s) => ({ ...s, [id]: null }));
      setTimerTotal((s) => ({ ...s, [id]: 0 }));
      clearPersistedTimer(id);
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

  const startTimer = (id: number, minutes: number) => {
    const targetEnd = Date.now() + minutes * 60 * 1000;
    const totalSecs = minutes * 60;

    sendBleCommand(`TIMER:${id}:${minutes}`).catch(() => {});
    setTimerTotal((s) => ({ ...s, [id]: totalSecs }));
    setTimerEnd((s) => ({ ...s, [id]: targetEnd }));
    persistTimer(id, targetEnd, totalSecs);

    onRef.current[id] = true;
    setOn((s) => ({ ...s, [id]: true }));

    if (!pub(`${BASE}/relay${id}/timer/set`, String(minutes))) return;
    setPend(id, true);
    setTimeout(() => pendingRef.current[id] && setPend(id, false), 4000);
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
    haptics,
    themeMode,
    isDark,
    colors,
    C: colors,
    wifiStatus,
    wifiSsid,
    wifiIp,
    setName,
    setHaptics,
    setThemeMode,
    toggle: (id) => {
      const nextVal = !onRef.current[id];
      send(id, nextVal);
    },
    allSet: (v) => {
      CHANNELS.forEach((ch) => send(ch.id, v));
    },
    startTimer,
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
  };

  return <HomeCtx.Provider value={value}>{children}</HomeCtx.Provider>;
}
